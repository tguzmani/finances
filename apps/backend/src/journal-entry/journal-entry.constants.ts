export { JOURNAL_ACCOUNTS } from '../accounts/account.constants';

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
 * Writing "+ Esther" anywhere in a description splits the expense in half: the
 * classified account takes one share and Esther's the other, against a single
 * credit for the full amount.
 *
 * The marker never reaches the ledger — the sheet shows the description alone —
 * and the classifier never sees it either, so "Te + Esther" is still classified
 * as tea rather than as an Esther expense.
 */
const SPLIT_MARKER = /\s*\+\s*esther\b\s*/gi;

export const SPLIT_SHARE = {
  account: 'Gastos Esther',
  category: 'Esther',
  subcategory: 'Esther',
};

/** True when the description asks for the expense to be split. */
export function hasSplitMarker(description: string): boolean {
  SPLIT_MARKER.lastIndex = 0;
  return SPLIT_MARKER.test(description);
}

/** The description as it should be classified and written, without the marker. */
export function stripSplitMarker(description: string): string {
  return description
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
