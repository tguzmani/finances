import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { OpenRouterService } from '../../common/open-router.service';
import { REAL_ACCOUNTS } from '../../accounts/account.constants';

const ACCOUNT_VALUES = REAL_ACCOUNTS as [string, ...string[]];

const TransferDraftSchema = z.object({
  amount: z.number().positive().nullable(),
  debitAccount: z.enum(ACCOUNT_VALUES).nullable(),
  creditAccount: z.enum(ACCOUNT_VALUES).nullable(),
  description: z.string().min(1),
});

export type TransferDraft = z.infer<typeof TransferDraftSchema>;

const ACCOUNTS_LIST = REAL_ACCOUNTS.join(', ');

const SYSTEM_PROMPT = `You extract a transfer between the user's own accounts from a natural-language message (Spanish or English) sent to their personal finance bot.

Return a JSON object with these fields. Use null for any amount or account the message does not state — DO NOT guess. The description is always filled in.

Fields:
- amount: positive number in USD, no currency symbols or thousand separators.
- debitAccount: the account that RECEIVES the money (the destination).
- creditAccount: the account the money COMES FROM (the source).
- description: a 2-4 word summary of the transfer, in the same language the user wrote (usually Spanish). Transfers are routine, so stay plain and factual: name the movement, not a story. Always fill this in — when the message gives no reason, describe the movement itself ("Traspaso a Binance", "Pago tarjeta").

Both accounts must be one of exactly these names, copied verbatim: ${ACCOUNTS_LIST}

Match accounts through typos, abbreviations and Spanish or English wording ("bofa" -> "Bofa", "tarjeta de credito" / "tdc" -> "Bofa TDC", "binance" -> "Binance"). Use null when no account in the list is a plausible match.

Direction matters: "pasé 200 de Bofa a Binance" moves money OUT of Bofa INTO Binance, so creditAccount is "Bofa" and debitAccount is "Binance". Phrases like "pagué la tarjeta con bofa" move money out of Bofa into the card, so creditAccount is "Bofa" and debitAccount is "Bofa TDC".

Examples:
Input: "pasé 200 de bofa a binance"
Output: {"amount":200,"debitAccount":"Binance","creditAccount":"Bofa","description":"Traspaso a Binance"}

Input: "transferi 1500 a evo25 desde la tdc para la inversion"
Output: {"amount":1500,"debitAccount":"EVO25","creditAccount":"Bofa TDC","description":"Inversión EVO25"}

Input: "pague 320.50 de la tarjeta de credito con bofa"
Output: {"amount":320.5,"debitAccount":"Bofa TDC","creditAccount":"Bofa","description":"Pago tarjeta"}

Input: "mandé plata a wallet"
Output: {"amount":null,"debitAccount":"Wallet","creditAccount":null,"description":"Traspaso a wallet"}
`;

@Injectable()
export class TransferExtractionService {
  private readonly logger = new Logger(TransferExtractionService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async extract(text: string): Promise<TransferDraft> {
    this.logger.log(`Extracting transfer from: "${text}"`);

    const draft = await this.openRouter.chatStructured<TransferDraft>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      TransferDraftSchema,
      { schemaName: 'transfer_draft', temperature: 0.1, maxTokens: 200 },
    );

    // The same account on both sides is never a transfer
    if (draft.debitAccount && draft.debitAccount === draft.creditAccount) {
      this.logger.warn(`Both sides resolved to ${draft.debitAccount}, dropping the credit side`);
      return { ...draft, creditAccount: null };
    }

    return draft;
  }
}
