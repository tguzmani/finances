import { Injectable } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { BanescoParser } from './banesco.parser';

@Injectable()
export class BanescoEmailService extends BaseEmailService implements IBankEmailService {
  // Card alerts and Pago Directo notices come from different Banesco addresses.
  private readonly BANESCO_SENDER = [
    'Notificacion@banesco.com',
    'notificaciones@banesco.com',
  ];
  private readonly VALID_SUBJECTS = [
    'Notificación Banesco',
    'Resumen de Operaciones con TDD Banesco',
    'Cobro Inmediato',
  ];

  constructor(private readonly banescoParser: BanescoParser) {
    super(BanescoEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.BANESCO_SENDER,
      subjectPatterns: this.VALID_SUBJECTS,
    };
  }

  getBankPlatform(): TransactionPlatform {
    return TransactionPlatform.BANESCO;
  }

  parseEmails(emails: RawEmail[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (const email of emails) {
      const parsed = this.banescoParser.parse(email.subject, email.body);

      const enriched = parsed.map(({ hasStableReference, method, ...tx }) => ({
        ...tx,
        platform: TransactionPlatform.BANESCO,
        method: method ?? PaymentMethod.DEBIT_CARD,
        type: TransactionType.EXPENSE,
        // Notification and summary emails report the same purchase with different
        // references, so the amount is the only reliable duplicate signal. Emails
        // that carry their own reference (Pago Directo) dedupe by transactionId.
        dedupeByAmount: !hasStableReference,
      }));

      transactions.push(...enriched);
    }

    return transactions;
  }
}
