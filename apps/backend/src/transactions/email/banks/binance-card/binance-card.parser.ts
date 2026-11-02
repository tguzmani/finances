import { Injectable, Logger } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

/**
 * "You've paid 91.7 USD at TICKETMUNDO BY YUMMY." The amount and the merchant
 * are the whole alert; it carries no reference number, so the timestamp in the
 * subject identifies the purchase.
 */
const PAID = /You[''’]?ve paid\s+([\d.,]+)\s+([A-Z]{3,4})\s+at\s+(.+?)\s*\.\s*(?:If this|$)/is;

/** "Binance Card - Transaction Successful - 2026-11-02 19:51:47 (UTC)" */
const SUBJECT_STAMP = /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s*\(UTC\)/;

@Injectable()
export class BinanceCardParser {
  private readonly logger = new Logger(BinanceCardParser.name);

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    const match = PAID.exec(body);

    if (!match) {
      this.logger.warn(`Card purchase email carried no amount: "${subject}"`);
      return null;
    }

    const [, amountStr, currency, merchant] = match;
    const amount = parseFloat(amountStr.replace(/,/g, ''));

    if (!Number.isFinite(amount) || amount <= 0) return null;

    return {
      date: emailDate,
      amount,
      currency: currency.toUpperCase(),
      transactionId: `BINANCE_CARD_${this.stamp(subject, emailDate)}`,
      platform: TransactionPlatform.BINANCE,
      method: PaymentMethod.DEBIT_CARD,
      type: TransactionType.EXPENSE,
      description: merchant.replace(/\s+/g, ' ').trim(),
    };
  }

  /**
   * The subject's own timestamp, down to the second, which separates two
   * purchases of the same amount at the same merchant on the same day. Falls
   * back to the email's date when Binance changes the subject.
   */
  private stamp(subject: string, emailDate: Date): string {
    const match = SUBJECT_STAMP.exec(subject);

    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return `${year}${month}${day}${hour}${minute}${second}`;
    }

    return emailDate.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  }
}
