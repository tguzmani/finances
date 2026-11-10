/**
 * How a transaction's enums are written for the user. Every flow that shows a
 * transaction reads them from here, so a name is spelled the same in the wizard,
 * in a recalled entry and in the review list.
 */

const PLATFORM_LABELS: Record<string, string> = {
  BANESCO: 'Banesco',
  BANK_OF_AMERICA: 'Bank of America',
  BINANCE: 'Binance',
  WALLET: 'Wallet',
  CASH_BOX: 'Cash Box',
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  DEBIT_CARD: 'Debit Card',
  PAGO_MOVIL: 'Pago Móvil',
  ELECTRONIC_TRANSFER: 'Electronic Transfer',
  ZELLE: 'Zelle',
  CREDIT_CARD: 'Credit Card',
  BINANCE_PAY: 'Binance Pay',
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
};

const TYPE_LABELS: Record<string, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
};

const TYPE_ICONS: Record<string, string> = {
  INCOME: '💰',
  EXPENSE: '💸',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] || platform;
}

export function methodLabel(method: string): string {
  return METHOD_LABELS[method] || method;
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

/** The fallback is the expense icon: an unknown type is still money leaving. */
export function typeIcon(type: string): string {
  return TYPE_ICONS[type] || '💸';
}
