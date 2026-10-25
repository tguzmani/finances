import { parseWrittenAmount } from '../common/written-amount';

export { ASSET_ACCOUNTS, JOURNAL_ACCOUNTS, LIABILITY_ACCOUNTS } from '../accounts/account.constants';

/** Ledger account name for Banesco, and the platform that maps onto it. */
export const BANESCO_ACCOUNT = 'Banesco';

export const PLATFORM_TO_ACCOUNT: Record<string, string> = {
  BANESCO: 'Banesco',
  BINANCE: 'Binance',
  BANK_OF_AMERICA: 'Bofa',
  WALLET: 'Wallet',
  CASH_BOX: 'Cash',
};

/**
 * A description marked "+ Esther" or "+ Bofa" splits the expense in two: the
 * classified account takes one share and the marked account the other, against
 * a single credit for the full amount.
 *
 * Esther's share is an expense of its own. Bofa's is a move of assets, so its
 * row carries no category.
 *
 * The two shares are halves unless the marker names a figure, which can sit on
 * either side of the "+": "Amazon + Bofa (125)" puts 125 on Bofa, and
 * "Amazon (75) + Bofa" puts 75 on Amazon's account. Whichever side was not
 * named takes whatever the credit has left, so the entry balances by
 * construction. A figure on both sides could contradict the credit, so the
 * first one wins and the other side is the remainder.
 *
 * The marker never reaches the ledger — the sheet shows the description alone —
 * and the classifier never sees it either, so "Te + Esther" is still classified
 * as tea rather than as an Esther expense.
 */
export interface SplitShare {
  account: string;
  category: string;
  subcategory: string;
}

const SPLIT_SHARES: Record<string, SplitShare> = {
  Esther: { account: 'Gastos Esther', category: 'Esther', subcategory: 'Esther' },
  Bofa: { account: 'Bofa', category: '', subcategory: '' },
};

/** The names the marker accepts, for the prompts that have to keep it intact. */
export const SPLIT_TARGETS = Object.keys(SPLIT_SHARES);

const SHARE_BY_TARGET = new Map(
  Object.entries(SPLIT_SHARES).map(([target, share]) => [target.toLowerCase(), share]),
);

const SPLIT_MARKER = new RegExp(
  String.raw`\s*(?:\(\s*([\d.,]+)\s*\)\s*)?\+\s*(${SPLIT_TARGETS.join('|')})\b(?:\s*\(\s*([\d.,]+)\s*\))?\s*`,
  'i',
);

export interface Split {
  share: SplitShare;
  /** What the marker put on the classified account, in the transaction's currency. */
  classifiedAmount: number | null;
  /** What the marker put on the marked account, in the transaction's currency. */
  shareAmount: number | null;
}

/** A figure the marker named, or null when it named none or named nothing usable. */
function namedAmount(text: string | undefined): number | null {
  if (!text) return null;
  const amount = parseWrittenAmount(text);
  return amount != null && amount > 0 ? amount : null;
}

/** The split a description asks for, or null when it asks for none. */
export function readSplit(description: string): Split | null {
  const match = SPLIT_MARKER.exec(description || '');
  if (!match) return null;

  const [, beforeMarker, target, afterMarker] = match;
  const share = SHARE_BY_TARGET.get(target.toLowerCase());
  if (!share) return null;

  const classifiedAmount = namedAmount(beforeMarker);

  return {
    share,
    classifiedAmount,
    shareAmount: classifiedAmount == null ? namedAmount(afterMarker) : null,
  };
}

/** True when the description asks for the expense to be split. */
export function hasSplitMarker(description: string): boolean {
  return readSplit(description) !== null;
}

/** The description as it should be classified and written, without the marker. */
export function stripSplitMarker(description: string): string {
  return (description || '')
    .replace(SPLIT_MARKER, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Merchants that are always delivery expenses.
 * When a description matches one of these, the entry must be classified as
 * debit "Gastos delivery" / category "Comida" / subcategory "Delivery".
 * Extend this list as new delivery merchants show up.
 */
export const DELIVERY_MERCHANTS: string[] = ['Rollo', 'Plan B', 'Pollos Camper'];

export const JOURNAL_CATEGORIES: Record<string, string[]> = {
  Esther:   ['Esther'],
  Comida:   ['Pescado', 'Carne', 'Mercado', 'Delivery', 'Local'],
  Carro:    ['Gasolina', 'Servicio'],
  Vicio:    ['Curda', 'Weed', 'Cafeína'],
  Servicio: ['Suscripciones', 'Internet', 'Gimnasio'],
  Otros:    ['Otros', 'Comisiones'],
  Salud:    ['Consultas', 'Medicinas'],
  UCAB:     ['Matrícula'],
  Wishlist: ['Wishlist'],
  Casa:     ['Neyda', 'Casa'],
};

/** True when a transaction's platform books against the Banesco ledger account. */
export function isBanescoPlatform(platform: string): boolean {
  return PLATFORM_TO_ACCOUNT[platform] === BANESCO_ACCOUNT;
}

/** True when either leg of a journal entry touches Banesco. */
export function touchesBanesco(...accounts: (string | null | undefined)[]): boolean {
  return accounts.some((account) => account === BANESCO_ACCOUNT);
}
