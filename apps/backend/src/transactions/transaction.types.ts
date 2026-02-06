export enum TransactionStatus {
  NEW = 'NEW',
  REVIEWED = 'REVIEWED',
  REGISTERED = 'REGISTERED',
  REJECTED = 'REJECTED',
}

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

export enum TransactionPlatform {
  BANESCO = 'BANESCO',
  BINANCE = 'BINANCE',
  BANK_OF_AMERICA = 'BANK_OF_AMERICA',
}

export enum PaymentMethod {
  DEBIT_CARD = 'DEBIT_CARD',
  PAGO_MOVIL = 'PAGO_MOVIL',
  ZELLE = 'ZELLE',
  CREDIT_CARD = 'CREDIT_CARD',
  BINANCE_PAY = 'BINANCE_PAY',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  CASH = 'CASH',
}
