import { Injectable, Logger } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod } from '@prisma/client';
import { ParsedTransaction } from '../../email.interfaces';

@Injectable()
export class GooglePlayParser {
  private readonly logger = new Logger(GooglePlayParser.name);

  parse(subject: string, body: string, emailDate: Date): ParsedTransaction | null {
    try {
      // Extract order number (transaction ID)
      // Pattern: "Order number: GPY.5418-0535-5818-75418..18"
      const orderMatch = body.match(/Order number:\s*([A-Z0-9\.\-]+)/i);
      const orderId = orderMatch ? orderMatch[1].trim() : null;

      if (!orderId) {
        this.logger.warn('Could not extract order number');
        return null;
      }

      // Extract amount from "Total: USD 7,99/month" or "Total: USD 7.99/month"
      // Handle both comma and period as decimal separator
      const amountMatch = body.match(/Total:\s*USD\s*([\d,\.]+)/i);
      if (!amountMatch) {
        this.logger.warn('Could not extract amount');
        return null;
      }

      const amountStr = amountMatch[1].replace(',', '.'); // Normalize comma to period
      const amount = parseFloat(amountStr);

      if (isNaN(amount)) {
        this.logger.warn(`Invalid amount: ${amountStr}`);
        return null;
      }

      // Extract service name (e.g., "YouTube Premium")
      // Pattern: "Item 	Price\nYouTube Premium (YouTube) USD 7,99/month"
      const serviceMatch = body.match(/Item\s+Price\s+([^\n]+)/i);
      let serviceName = serviceMatch ? serviceMatch[1].trim() : 'Google Play';

      // Remove the monthly price from description (e.g., "USD 7,99/month" or "USD 7.99/month")
      serviceName = serviceName.replace(/\s+USD\s+[\d,\.]+\/month/i, '').trim();

      return {
        date: emailDate,
        amount,
        currency: 'USD',
        transactionId: `GOOGLEPLAY_${orderId}`,
        platform: TransactionPlatform.BANK_OF_AMERICA,
        method: PaymentMethod.CREDIT_CARD,
        description: serviceName,
      };
    } catch (error) {
      this.logger.error(`Error parsing Google Play email: ${error.message}`);
      return null;
    }
  }
}
