import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { OpenRouterService } from '../../common/open-router.service';

const TransactionDraftSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).nullable(),
  platform: z.enum(['BANESCO', 'BANK_OF_AMERICA', 'BINANCE', 'WALLET', 'CASH_BOX']).nullable(),
  method: z.enum(['DEBIT_CARD', 'PAGO_MOVIL', 'ELECTRONIC_TRANSFER', 'ZELLE', 'CREDIT_CARD', 'BINANCE_PAY', 'DEPOSIT', 'WITHDRAWAL']).nullable(),
  currency: z.enum(['VES', 'USD', 'USDT']).nullable(),
  amount: z.number().positive().nullable(),
  description: z.string().min(1).nullable(),
  date: z.string().nullable(),
});

export type TransactionDraft = z.infer<typeof TransactionDraftSchema>;

const SYSTEM_PROMPT = `You extract structured transaction data from natural-language messages (Spanish or English) sent by the user to their personal finance bot.

Return a JSON object with these fields. Use null for any field you cannot determine from the input — DO NOT guess or fabricate.

Fields:
- type: "INCOME" if user received money, "EXPENSE" if user paid/spent.
- platform: account/wallet used. One of: BANESCO, BANK_OF_AMERICA, BINANCE, WALLET, CASH_BOX.
- method: payment method. One of: DEBIT_CARD, PAGO_MOVIL, ELECTRONIC_TRANSFER, ZELLE, CREDIT_CARD, BINANCE_PAY, DEPOSIT, WITHDRAWAL. Null if not stated.
- currency: VES, USD, or USDT.
- amount: positive number, no currency symbols.
- description: short human-readable description of what the transaction was for.
- date: ISO 8601 datetime WITH the same timezone offset as the "current time" provided in the user message (the user lives in Venezuela, UTC-4). Use the "current time" as your reference for relative phrases like "hace 30 minutos", "ayer", "today at 5pm". Return null if no time is mentioned.

Currency-to-platform inference rules (apply when platform is not explicitly stated):
- If amount is in VES (bolívares, bs, bs.s, Bs), platform MUST be BANESCO and currency VES.
- If amount is in USDT, platform MUST be BINANCE and currency USDT.
- If amount is in USD/dollars and no account specified, leave platform null.

Platform-implied currency (apply when currency is not explicitly stated):
- BANESCO → VES
- BINANCE → USDT
- BANK_OF_AMERICA, WALLET, CASH_BOX → USD

Examples (assume current time = 2026-05-22T22:00:00-04:00):
Input: "gasté 500 bs en la panadería"
Output: {"type":"EXPENSE","platform":"BANESCO","method":null,"currency":"VES","amount":500,"description":"panadería","date":null}

Input: "Gaste 9615.31 Bs en Farmatodo con tarjeta de debito hace 30 minutos"
Output: {"type":"EXPENSE","platform":"BANESCO","method":"DEBIT_CARD","currency":"VES","amount":9615.31,"description":"Farmatodo","date":"2026-05-22T21:30:00-04:00"}

Input: "pagué 25 dólares con bofa por netflix"
Output: {"type":"EXPENSE","platform":"BANK_OF_AMERICA","method":null,"currency":"USD","amount":25,"description":"netflix","date":null}

Input: "recibí pago"
Output: {"type":"INCOME","platform":null,"method":null,"currency":null,"amount":null,"description":"pago","date":null}
`;

@Injectable()
export class TransactionExtractionService {
  private readonly logger = new Logger(TransactionExtractionService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async extract(text: string): Promise<TransactionDraft> {
    this.logger.log(`Extracting transaction from: "${text}"`);

    // Anchor to Venezuela wall-clock so the LLM resolves relative phrases ("hace 30 minutos")
    // against the user's local time. Venezuela has no DST; offset is always -04:00.
    const nowVenezuela = new Date(Date.now() - 4 * 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '-04:00');
    const userMessage = `Current time: ${nowVenezuela}\n\nUser message: ${text}`;

    const draft = await this.openRouter.chatStructured<TransactionDraft>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      TransactionDraftSchema,
      { schemaName: 'transaction_draft', temperature: 0.1, maxTokens: 300 },
    );

    return this.applyInferenceRules(draft);
  }

  private applyInferenceRules(draft: TransactionDraft): TransactionDraft {
    const result = { ...draft };

    if (result.currency === 'VES' && !result.platform) {
      result.platform = 'BANESCO';
    }
    if (result.currency === 'USDT' && !result.platform) {
      result.platform = 'BINANCE';
    }

    if (result.platform && !result.currency) {
      const platformCurrency: Record<string, 'VES' | 'USD' | 'USDT'> = {
        BANESCO: 'VES',
        BINANCE: 'USDT',
        BANK_OF_AMERICA: 'USD',
        WALLET: 'USD',
        CASH_BOX: 'USD',
      };
      result.currency = platformCurrency[result.platform] ?? null;
    }

    return result;
  }
}
