import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { OpenRouterService } from './open-router.service';
import { AMOUNT_FORMAT_RULES, CURRENCY_FORMAT_RULES } from './amount-format.rules';

const CURRENCIES = ['VES', 'USD', 'EUR'] as const;

const AmountDraftSchema = z.object({
  amount: z.number().positive().nullable(),
  currency: z.enum(CURRENCIES).nullable(),
});

export type AmountDraft = z.infer<typeof AmountDraftSchema>;
export type SupportedCurrency = (typeof CURRENCIES)[number];

const SYSTEM_PROMPT = `You pull a money amount and its currency out of a short message sent to a personal finance bot in Venezuela. The message is usually Spanish, sometimes English, and often just an amount on its own.

Return a JSON object with:
- amount: the number, as a plain number with no separators or symbols. Null if the message states no amount.
- currency: one of "VES", "USD", "EUR". Null if the message names none.

${AMOUNT_FORMAT_RULES}

${CURRENCY_FORMAT_RULES}

Resolve simple arithmetic when the user writes it: "23165.05-11000" is 12165.05.

Examples:
Input: "100 USD"          Output: {"amount":100,"currency":"USD"}
Input: "18 USd"           Output: {"amount":18,"currency":"USD"}
Input: "$18 US"           Output: {"amount":18,"currency":"USD"}
Input: "$18,68"           Output: {"amount":18.68,"currency":"USD"}
Input: "18,68 usd"        Output: {"amount":18.68,"currency":"USD"}
Input: "27,837.82 bs"     Output: {"amount":27837.82,"currency":"VES"}
Input: "27.837,82 bolos"  Output: {"amount":27837.82,"currency":"VES"}
Input: "1,234 bs"         Output: {"amount":1234,"currency":"VES"}
Input: "50 euros"         Output: {"amount":50,"currency":"EUR"}
Input: "8177.49"          Output: {"amount":8177.49,"currency":null}
Input: "hola"             Output: {"amount":null,"currency":null}
`;

@Injectable()
export class AmountExtractionService {
  private readonly logger = new Logger(AmountExtractionService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  /**
   * Reads an amount and currency out of whatever the user typed.
   *
   * `defaultCurrency` fills in when the message names none, for callers where
   * the currency is implied by the flow rather than the text.
   */
  async extract(
    text: string,
    defaultCurrency?: SupportedCurrency,
  ): Promise<AmountDraft> {
    this.logger.log(`Extracting amount from: "${text}"`);

    const draft = await this.openRouter.chatStructured<AmountDraft>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      AmountDraftSchema,
      { schemaName: 'amount_draft', temperature: 0, maxTokens: 100 },
    );

    const currency = draft.currency ?? defaultCurrency ?? null;
    const amount = this.roundToCents(draft.amount);

    this.logger.log(`Extracted: ${amount} ${currency}`);
    return { amount, currency };
  }

  /**
   * Money never carries more than two decimals, so anything past them came from
   * the model rather than the user.
   */
  private roundToCents(amount: number | null): number | null {
    if (amount === null) return null;
    return Math.round(amount * 100) / 100;
  }
}
