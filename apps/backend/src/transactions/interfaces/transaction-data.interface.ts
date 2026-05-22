export interface TransactionAccountEntry {
  account: string;
  amount: number;
  category?: string;
  subcategory?: string;
}

export interface TransactionData {
  date: string;
  description: string;
  debit_accounts: TransactionAccountEntry[];
  credit_accounts: TransactionAccountEntry[];
}
