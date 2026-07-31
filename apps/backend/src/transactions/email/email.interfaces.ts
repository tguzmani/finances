import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';

export interface RawEmail {
  subject: string;
  body: string;
  date: Date;
  from?: string;
}

export interface ParsedTransaction {
  date: Date;
  amount: number;
  currency: string;
  transactionId: string;
  platform: TransactionPlatform;
  method: PaymentMethod;
  type: TransactionType;
  description?: string;
  /**
   * Deduplicate against existing transactions of the same platform with the same
   * amount. Only for senders whose emails lack a stable reference across formats
   * (Banesco). Sources with a real order/invoice number rely on transactionId.
   */
  dedupeByAmount?: boolean;
  /**
   * Register the journal entry in Google Sheets automatically when no sheet
   * update rule matched, instead of leaving the transaction for manual review.
   */
  autoRegister?: boolean;
}

export interface BankEmailConfig {
  sender: string;
  subjectPatterns: string[];
}

export interface IBankEmailService {
  fetchEmails(limit: number): Promise<RawEmail[]>;
  parseEmails(emails: RawEmail[]): ParsedTransaction[] | Promise<ParsedTransaction[]>;
  getBankPlatform(): TransactionPlatform;
}
