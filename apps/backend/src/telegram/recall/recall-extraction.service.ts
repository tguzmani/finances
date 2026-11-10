import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { OpenRouterService } from '../../common/open-router.service';
import { SPLIT_TARGETS } from '../../journal-entry/journal-entry.constants';
import {
  applyDraftInferenceRules,
  DRAFT_FIELD_RULES,
  TransactionDraft,
  TransactionDraftSchema,
  venezuelaNowIso,
} from '../transactions/transaction-draft';

const RecalledDraftSchema = TransactionDraftSchema.extend({
  /** The amount was hedged ("casi 63000", "como 22 mil"), so it is a figure to refine. */
  approximate: z.boolean(),
});

const RecollectionSchema = z.object({
  entries: z.array(RecalledDraftSchema),
});

export type RecalledDraft = z.infer<typeof RecalledDraftSchema>;

const SYSTEM_PROMPT = `You read a recollection — one message in which the user remembers several transactions they forgot to register in their personal finance bot — and split it into one entry per transaction.

Return a JSON object: {"entries": [ ... ]}, one object per transaction, in the order the user mentions them. Use null for any field you cannot determine. DO NOT guess or fabricate.

${DRAFT_FIELD_RULES}

Extra field:
- approximate: true when the user hedged the amount ("casi 63000", "como 22 mil", "más o menos 500", "unos 40 dólares", a suspiciously round figure in a recollection), false when they stated it exactly.

Splitting the recollection:
- Each purchase, payment or receipt the user remembers is its own entry. "hicimos mercado por 63000 y luego otro mercado por 22000" is two entries.
- Money handed back to the user by ${SPLIT_TARGETS.join(' or ')} for one of those purchases is NOT an entry of its own. It is that purchase's split: append "+ <name> (<their share>)" to its description, keeping the figure in parentheses.
- Anything stated as a sum of its parts stays one entry with the total as amount.
- Ignore sentences that carry no transaction ("se me olvidó registrar", "ya no me acuerdo bien").

Examples (assume current time = 2026-11-09T18:00:00-04:00):
Input: "se me olvidó guardar: hicimos mercado por casi 63000 VES y Esther me dio 40000, luego hicimos otro mercado por 22000 y Esther me dio 11000"
Output: {"entries":[{"type":"EXPENSE","platform":"BANESCO","method":null,"currency":"VES","amount":63000,"description":"mercado + Esther (40000)","date":null,"approximate":true},{"type":"EXPENSE","platform":"BANESCO","method":null,"currency":"VES","amount":22000,"description":"mercado + Esther (11000)","date":null,"approximate":false}]}

Input: "ayer gasté 15 dólares con bofa en el cine y pagué 230 bs de estacionamiento"
Output: {"entries":[{"type":"EXPENSE","platform":"BANK_OF_AMERICA","method":null,"currency":"USD","amount":15,"description":"cine","date":"2026-11-08T18:00:00-04:00","approximate":false},{"type":"EXPENSE","platform":"BANESCO","method":null,"currency":"VES","amount":230,"description":"estacionamiento","date":"2026-11-08T18:00:00-04:00","approximate":false}]}

Input: "me pagaron como 300 usdt por el freelance el sábado"
Output: {"entries":[{"type":"INCOME","platform":"BINANCE","method":null,"currency":"USDT","amount":300,"description":"freelance","date":"2026-11-07T18:00:00-04:00","approximate":true}]}
`;

/**
 * Turns "hicimos mercado por casi 63000 y Esther me dio 40000, luego otro por
 * 22000..." into the entries it describes. The reasoning worth paying an LLM
 * for is the splitting: which sentences are transactions, which figure belongs
 * to which one, and which handover is a reimbursement rather than income.
 */
@Injectable()
export class RecallExtractionService {
  private readonly logger = new Logger(RecallExtractionService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async extract(text: string): Promise<RecalledDraft[]> {
    this.logger.log(`Extracting recollection from: "${text}"`);

    const userMessage = `Current time: ${venezuelaNowIso()}\n\nUser message: ${text}`;

    const { entries } = await this.openRouter.chatStructured<{ entries: RecalledDraft[] }>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      RecollectionSchema,
      { schemaName: 'recollection', temperature: 0.1, maxTokens: 1200 },
    );

    return entries.map((entry) => ({
      ...entry,
      ...applyDraftInferenceRules(entry as TransactionDraft),
    }));
  }
}
