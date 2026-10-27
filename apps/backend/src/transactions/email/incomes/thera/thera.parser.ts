import { Injectable, Logger } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

/**
 * The withdrawal figure, as the email lays it out:
 *
 *   Withdrawal Amount  USD 5000.0  Withdrawal Method  Bank Transfer • USD
 *
 * Only the HTML part says this. Thera's plain-text alternative drops the whole
 * table, which is why this income went unrecorded for as long as it did.
 */
const AMOUNT = /Withdrawal\s+Amount\s*USD\s*([\d,]+\.?\d*)/i;

/**
 * Names the payer so the Libro's "Pago 1/1 Trybe" rule picks the income up. The
 * work is DevSignal's, billed to Trybe, and Thera is only the rail it arrives
 * on, so the description carries all three.
 */
const DESCRIPTION = 'DevSignal/Trybe via Thera';

@Injectable()
export class TheraParser {
  private readonly logger = new Logger(TheraParser.name);

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    const match = body.match(AMOUNT);
    if (!match) {
      this.logger.warn(`No withdrawal amount in "${subject}"`);
      return null;
    }

    const amount = parseFloat(match[1].replace(/,/g, ''));
    if (!isFinite(amount) || amount <= 0) {
      this.logger.warn(`Unusable withdrawal amount "${match[1]}" in "${subject}"`);
      return null;
    }

    return {
      date: emailDate,
      amount,
      currency: 'USD',
      // Thera gives the notification no reference of its own, so the moment it
      // was sent stands in for one. It never changes, so a re-read of the same
      // email is skipped rather than booked twice.
      transactionId: `THERA_${emailDate.getTime()}_${amount}`,
      platform: TransactionPlatform.BANK_OF_AMERICA,
      method: PaymentMethod.ELECTRONIC_TRANSFER,
      type: TransactionType.INCOME,
      description: DESCRIPTION,
    };
  }
}
