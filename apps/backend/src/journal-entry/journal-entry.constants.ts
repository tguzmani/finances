export { JOURNAL_ACCOUNTS } from '../accounts/account.constants';

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
