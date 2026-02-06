import { Injectable, Logger } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

@Injectable()
export class AnthropicParser {
  private readonly logger = new Logger(AnthropicParser.name);

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    try {
      // Extract receipt number from subject
      // Pattern: "Your receipt from Anthropic, PBC #2611-0948-8287"
      const receiptMatch = subject.match(/#([\d\-]+)/);
      let receiptNumber = receiptMatch ? receiptMatch[1] : null;

      // Also try extracting from body if not in subject
      // Pattern: "Receipt number 	  	2611-0948-8287"
      if (!receiptNumber) {
        const bodyMatch = body.match(/Receipt number\s+([\d\-]+)/i);
        if (bodyMatch) {
          receiptNumber = bodyMatch[1];
        }
      }

      if (!receiptNumber) {
        this.logger.warn('Could not extract receipt number');
        return null;
      }

      // Extract amount from body
      // Pattern: "$100.00" at beginning or "Receipt from Anthropic, PBC\n$100.00"
      const amountMatch = body.match(/\$\s*([\d,]+\.?\d*)/);
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

      // Extract payment date if available
      // Pattern: "Paid January 18, 2026"
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
        transactionId: `ANTHROPIC_${receiptNumber}`,
        platform: TransactionPlatform.BANK_OF_AMERICA,
        method: PaymentMethod.CREDIT_CARD,
        description: 'Claude Max',
      };
    } catch (error) {
      this.logger.error(`Error parsing Anthropic email: ${error.message}`);
      return null;
    }
  }
}
