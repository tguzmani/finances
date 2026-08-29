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
