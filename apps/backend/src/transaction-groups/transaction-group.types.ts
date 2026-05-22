export enum TransactionGroupStatus {
  NEW = 'NEW',
  REGISTERED = 'REGISTERED',
}

export interface GroupAmountCalculation {
  totalAmount: number;
  currency: 'VES' | 'USD' | 'MIXED';
  type: 'INCOME' | 'EXPENSE' | 'NEUTRAL';
  hasMonetaryValue: boolean;
  excelFormula: string;
}
