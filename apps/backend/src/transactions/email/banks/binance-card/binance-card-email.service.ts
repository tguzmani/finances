import { Injectable } from '@nestjs/common';
import { TransactionPlatform } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { BinanceCardParser } from './binance-card.parser';

@Injectable()
export class BinanceCardEmailService extends BaseEmailService implements IBankEmailService {
  private readonly BINANCE_SENDER = 'do-not-reply@ses.binance.com';

  /**
   * Only the purchase alert. "Transaction Refund Successful", the verification
   * link and the card's own notices say nothing about money leaving the wallet.
   */
  private readonly VALID_SUBJECTS = ['Binance Card - Transaction Successful'];

  /**
   * The card was already in use before the bot read these emails, and those
   * purchases are on the ledger by hand. Anything older than the first alert
   * the bot is meant to pick up stays out, so the backlog is not booked twice.
   */
  private readonly SYNCED_FROM = new Date('2026-11-02T19:00:00Z');

  constructor(private readonly parser: BinanceCardParser) {
    super(BinanceCardEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.BINANCE_SENDER,
      subjectPatterns: this.VALID_SUBJECTS,
    };
  }

  getBankPlatform(): TransactionPlatform {
    return TransactionPlatform.BINANCE;
  }

  parseEmails(emails: RawEmail[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (const email of emails) {
      if (email.date < this.SYNCED_FROM) continue;

      const parsed = this.parser.parse(email.subject, email.body, email.date);

      if (parsed) {
        transactions.push(parsed);
      }
    }

    return transactions;
  }
}
