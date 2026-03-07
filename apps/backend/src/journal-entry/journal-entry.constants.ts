export { JOURNAL_ACCOUNTS } from '../accounts/account.constants';

export const PLATFORM_TO_ACCOUNT: Record<string, string> = {
  BANESCO: 'Banesco',
  BINANCE: 'Binance',
  BANK_OF_AMERICA: 'Bofa',
  WALLET: 'Wallet',
  CASH_BOX: 'Cash',
};

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
