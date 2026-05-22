import { Injectable } from '@nestjs/common';
import { TransactionPlatform } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { RenderParser } from './render.parser';

@Injectable()
export class RenderEmailService extends BaseEmailService implements IBankEmailService {
  private readonly RENDER_SENDER = 'invoice+statements@render.com';
  private readonly VALID_SUBJECTS = ['Your receipt from Render Services'];

  constructor(private readonly parser: RenderParser) {
    super(RenderEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.RENDER_SENDER,
      subjectPatterns: this.VALID_SUBJECTS,
    };
  }

  getBankPlatform(): TransactionPlatform {
    return TransactionPlatform.BANK_OF_AMERICA;
  }

  parseEmails(emails: RawEmail[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (const email of emails) {
      const parsed = this.parser.parse(email.subject, email.body, email.date);

      if (parsed) {
        transactions.push(parsed);
      }
    }

    return transactions;
  }
}
