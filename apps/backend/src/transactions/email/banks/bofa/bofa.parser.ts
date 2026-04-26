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

    return {
      date: emailDate,
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

    const transactionId = this.generateFallbackId('CREDIT', amount, emailDate);

    return {
      date: emailDate,
      amount,
      currency: this.CURRENCY,
      transactionId,
      platform: TransactionPlatform.BANK_OF_AMERICA,
      method: PaymentMethod.CREDIT_CARD,
      type: TransactionType.INCOME,
      description,
    };
  }

  private generateFallbackId(prefix: string, amount: number, date: Date): string {
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const amountStr = amount.toFixed(2).replace('.', '');
    return `${prefix}_${dateStr}_${amountStr}`;
  }
}
