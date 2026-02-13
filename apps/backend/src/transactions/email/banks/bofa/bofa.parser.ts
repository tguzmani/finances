import { Injectable } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

@Injectable()
export class BofaParser {
  private readonly CURRENCY = 'USD';

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    if (subject.startsWith('Zelle® payment of $')) {
      return this.parseZelle(subject, body, emailDate);
    }

    if (subject === "We've credited your account") {
      return this.parseCredit(body, emailDate);
    }

    return null;
  }

  private parseZelle(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    const amountMatch = subject.match(/Zelle® payment of \$([\d.,]+)/);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    const confirmationMatch = body.match(/Confirmation\s+(\w+)/i);
    const transactionId = confirmationMatch
      ? confirmationMatch[1]
      : this.generateFallbackId('ZELLE', amount, emailDate);

    // Convert UTC email date to Eastern Time (America/New_York)
    const easternDate = this.convertToEasternTime(emailDate);

    return {
      date: easternDate,
      amount,
      currency: this.CURRENCY,
      transactionId,
      platform: TransactionPlatform.BANK_OF_AMERICA,
      method: PaymentMethod.ZELLE,
      type: TransactionType.EXPENSE,
    };
  }

  private parseCredit(body: string, emailDate: Date): ParsedTransaction | null {
    // Extract amount: "Amount: $47.07"
    const amountMatch = body.match(/Amount:\s*\$?([\d.,]+)/i);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    // Extract merchant: "Merchant: TRAVEL CREDIT"
    const merchantMatch = body.match(/Merchant:\s*(.+?)(?:\n|$)/i);
    const description = merchantMatch ? merchantMatch[1].trim() : 'Credit';

    // Use email date (more accurate than "Date of credit" in body)
    const easternDate = this.convertToEasternTime(emailDate);

    const transactionId = this.generateFallbackId('CREDIT', amount, emailDate);

    return {
      date: easternDate,
      amount,
      currency: this.CURRENCY,
      transactionId,
      platform: TransactionPlatform.BANK_OF_AMERICA,
      method: PaymentMethod.CREDIT_CARD,
      type: TransactionType.INCOME,
      description,
    };
  }

  private convertToEasternTime(utcDate: Date): Date {
    // Convert UTC to Eastern Time (America/New_York)
    // Use Intl.DateTimeFormat to handle DST automatically
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const year = parseInt(getValue('year'));
    const month = parseInt(getValue('month')) - 1; // JS months are 0-indexed
    const day = parseInt(getValue('day'));
    const hour = parseInt(getValue('hour'));
    const minute = parseInt(getValue('minute'));
    const second = parseInt(getValue('second'));

    return new Date(year, month, day, hour, minute, second);
  }

  private generateFallbackId(prefix: string, amount: number, date: Date): string {
    // Convert to Eastern Time before generating ID
    const easternDate = this.convertToEasternTime(date);
    const dateStr = easternDate.toISOString().split('T')[0].replace(/-/g, '');
    const amountStr = amount.toFixed(2).replace('.', '');
    return `${prefix}_${dateStr}_${amountStr}`;
  }
}
