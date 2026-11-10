import { z } from 'zod';
import { SPLIT_TARGETS } from '../../journal-entry/journal-entry.constants';

/**
 * The shape every LLM-drafted transaction comes back in, and the prompt text
 * that describes it. One message and a recalled batch read the same fields by
 * the same rules, so they live here instead of in each extraction service.
 */
export const TransactionDraftSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).nullable(),
  platform: z.enum(['BANESCO', 'BANK_OF_AMERICA', 'BINANCE', 'WALLET', 'CASH_BOX']).nullable(),
  method: z.enum(['DEBIT_CARD', 'PAGO_MOVIL', 'ELECTRONIC_TRANSFER', 'ZELLE', 'CREDIT_CARD', 'BINANCE_PAY', 'DEPOSIT', 'WITHDRAWAL']).nullable(),
  currency: z.enum(['VES', 'USD', 'USDT']).nullable(),
  amount: z.number().positive().nullable(),
  description: z.string().min(1).nullable(),
  date: z.string().nullable(),
});

export type TransactionDraft = z.infer<typeof TransactionDraftSchema>;

/** What each field means and how to fill the ones the message leaves implicit. */
export const DRAFT_FIELD_RULES = `Fields:
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

Split markers (${SPLIT_TARGETS.map((t) => `"+ ${t}"`).join(', ')}):
- These say the expense is to be split, so they are part of the description and MUST be copied verbatim, never summarized away.
- A figure in parentheses next to the "+" says how much that side takes. Keep it, with its parentheses, exactly where it sits — dropping it silently halves the split.

Platform-implied currency (apply when currency is not explicitly stated):
- BANESCO → VES
- BINANCE → USDT
- BANK_OF_AMERICA, WALLET, CASH_BOX → USD`;

const PLATFORM_CURRENCY: Record<string, 'VES' | 'USD' | 'USDT'> = {
  BANESCO: 'VES',
  BINANCE: 'USDT',
  BANK_OF_AMERICA: 'USD',
  WALLET: 'USD',
  CASH_BOX: 'USD',
};

/**
 * Fills platform and currency from each other, since the prompt's rules are
 * only advice to the model and a draft that skipped them still has to hold up.
 */
export function applyDraftInferenceRules(draft: TransactionDraft): TransactionDraft {
  const result = { ...draft };

  if (result.currency === 'VES' && !result.platform) {
    result.platform = 'BANESCO';
  }
  if (result.currency === 'USDT' && !result.platform) {
    result.platform = 'BINANCE';
  }

  if (result.platform && !result.currency) {
    result.currency = PLATFORM_CURRENCY[result.platform] ?? null;
  }

  return result;
}

/**
 * Venezuela wall-clock, so the LLM resolves relative phrases ("hace 30 minutos",
 * "el sábado") against the user's local time. Venezuela has no DST; the offset
 * is always -04:00.
 */
export function venezuelaNowIso(): string {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().replace('Z', '-04:00');
}
