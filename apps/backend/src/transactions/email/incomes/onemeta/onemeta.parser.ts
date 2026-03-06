import { Injectable, Logger } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

@Injectable()
export class OneMetaParser {
  private readonly logger = new Logger(OneMetaParser.name);

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    try {
      // Extract amount from "Transfer Amount:     USD 1,250.00"
      const amountMatch = body.match(/Transfer Amount:\s*USD\s*([\d,]+\.?\d*)/i);
      if (!amountMatch) {
        this.logger.warn('Could not extract amount');
        return null;
      }

      const amountStr = amountMatch[1].replace(',', '');
      const amount = parseFloat(amountStr);

      if (isNaN(amount)) {
        this.logger.warn(`Invalid amount: ${amountStr}`);
        return null;
      }

      // Extract estimated arrival date for unique ID
      // Pattern: "Estimated Arrival:     Mar 02 - Mar 04, 2026"
      const dateMatch = body.match(/Estimated Arrival:\s*([A-Za-z]+\s+\d+)\s*-\s*[A-Za-z]+\s+\d+,\s*(\d{4})/i);
      let transactionId: string;

      if (dateMatch) {
        const datePart = `${dateMatch[1]}_${dateMatch[2]}`.replace(/\s+/g, '');
        transactionId = `ONEMETA_${datePart}_${amount}`;
      } else {
        const timestamp = emailDate.getTime();
        transactionId = `ONEMETA_${timestamp}_${amount}`;
      }

      return {
        date: emailDate,
        amount,
        currency: 'USD',
        transactionId,
        platform: TransactionPlatform.BANK_OF_AMERICA,
        method: PaymentMethod.ELECTRONIC_TRANSFER,
        type: TransactionType.INCOME,
        description: 'OneMeta Transfer',
      };
    } catch (error) {
      this.logger.error(`Error parsing OneMeta email: ${error.message}`);
      return null;
    }
  }
}
