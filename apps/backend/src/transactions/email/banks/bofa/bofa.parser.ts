import { Injectable } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

@Injectable()
export class BofaParser {
  private readonly CURRENCY = 'USD';

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    if (subject.startsWith('Zelle® payment of $')) {
      return this.parseZelle(subject, body, emailDate);
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
      : this.generateFallbackId(amount, emailDate);

    // Convert UTC email date to Eastern Time (America/New_York)
    const easternDate = this.convertToEasternTime(emailDate);

    return {
      date: easternDate,
      amount,
      currency: this.CURRENCY,
      transactionId,
      platform: TransactionPlatform.BANK_OF_AMERICA,
      method: PaymentMethod.ZELLE,
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

  private generateFallbackId(amount: number, date: Date): string {
    // Convert to Eastern Time before generating ID
    const easternDate = this.convertToEasternTime(date);
    const dateStr = easternDate.toISOString().split('T')[0].replace(/-/g, '');
    const amountStr = amount.toFixed(2).replace('.', '');
    return `ZELLE_${dateStr}_${amountStr}`;
  }
}
