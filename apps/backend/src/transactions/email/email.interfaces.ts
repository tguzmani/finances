import { TransactionPlatform, PaymentMethod } from '@prisma/client';

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
}

export interface BankEmailConfig {
  sender: string;
  subjectPatterns: string[];
}

export interface IBankEmailService {
  fetchEmails(limit: number): Promise<RawEmail[]>;
  parseEmails(emails: RawEmail[]): ParsedTransaction[];
  getBankPlatform(): TransactionPlatform;
}
