import { Injectable, Logger } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

@Injectable()
export class RenderParser {
  private readonly logger = new Logger(RenderParser.name);

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    try {
      // Extract receipt identifier from subject
      // Pattern: "Your receipt from Render Services"
      // Use date as unique ID since there's no receipt number in the email
      const dateStr = emailDate.toISOString().slice(0, 10).replace(/-/g, '');
      const transactionId = `RENDER_${dateStr}`;

      // Extract amount from body
      // Pattern: "$6.03"
      const amountMatch = body.match(/\$\s*([\d,]+\.?\d*)/);
      if (!amountMatch) {
        this.logger.warn('Could not extract amount from Render email');
        return null;
      }

      const amountStr = amountMatch[1].replace(',', '');
      const amount = parseFloat(amountStr);

      if (isNaN(amount)) {
        this.logger.warn(`Invalid amount: ${amountStr}`);
        return null;
      }

      // Extract payment date if available
      // Pattern: "Paid March 4, 2026."
      const dateMatch = body.match(/Paid\s+([A-Za-z]+\s+\d+,\s+\d+)/i);
      let transactionDate: Date;

      if (dateMatch) {
        transactionDate = new Date(dateMatch[1]);
      } else {
        transactionDate = emailDate;
      }

      return {
        date: transactionDate,
        amount,
        currency: 'USD',
        transactionId,
        platform: TransactionPlatform.BANK_OF_AMERICA,
        method: PaymentMethod.CREDIT_CARD,
        type: TransactionType.EXPENSE,
        description: 'Render Subscription',
      };
    } catch (error) {
      this.logger.error(`Error parsing Render email: ${error.message}`);
      return null;
    }
  }
}
