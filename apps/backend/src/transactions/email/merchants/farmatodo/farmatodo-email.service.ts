import { Injectable } from '@nestjs/common';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { FarmatodoParser } from './farmatodo.parser';
import { FarmatodoDescriptionService } from './farmatodo-description.service';

@Injectable()
export class FarmatodoEmailService extends BaseEmailService implements IBankEmailService {
  private readonly FARMATODO_SENDER = 'para-ti@novedades.farmatodo.com';
  private readonly VALID_SUBJECTS = ['Farmatodo - Factura Orden'];

  constructor(
    private readonly parser: FarmatodoParser,
    private readonly descriptionService: FarmatodoDescriptionService,
  ) {
    super(FarmatodoEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.FARMATODO_SENDER,
      subjectPatterns: this.VALID_SUBJECTS,
    };
  }

  /** Farmatodo orders are always paid with the Banesco debit card. */
  getBankPlatform(): TransactionPlatform {
    return TransactionPlatform.BANESCO;
  }

  async parseEmails(emails: RawEmail[]): Promise<ParsedTransaction[]> {
    const transactions: ParsedTransaction[] = [];

    for (const email of emails) {
      const order = this.parser.parse(email.subject, email.body);
      if (!order) continue;

      const description = await this.descriptionService.generate(order.items, order.orderNumber);

      transactions.push({
        date: email.date,
        amount: order.amount,
        currency: 'VES',
        transactionId: `FARMATODO_${order.orderNumber}`,
        platform: TransactionPlatform.BANESCO,
        method: PaymentMethod.DEBIT_CARD,
        type: TransactionType.EXPENSE,
        description,
        autoRegister: true,
      });
    }

    return transactions;
  }
}
