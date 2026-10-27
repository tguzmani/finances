import { Injectable } from '@nestjs/common';
import { TransactionPlatform } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { TheraParser } from './thera.parser';

/**
 * Thera sends three notifications for one payment. Only this one marks the
 * money leaving Thera for Bank of America, so only this one is read; the other
 * two would book the same income a second and third time.
 */
@Injectable()
export class TheraEmailService extends BaseEmailService implements IBankEmailService {
  private readonly THERA_SENDER = 'notifications@getthera.com';
  private readonly VALID_SUBJECTS = ['Your money is on the way'];

  constructor(private readonly parser: TheraParser) {
    super(TheraEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.THERA_SENDER,
      subjectPatterns: this.VALID_SUBJECTS,
      // The amount is in the HTML table only; the plain-text part omits it.
      readHtml: true,
    };
  }

  getBankPlatform(): TransactionPlatform {
    return TransactionPlatform.BANK_OF_AMERICA;
  }

  parseEmails(emails: RawEmail[]): ParsedTransaction[] {
    return emails
      .map((email) => this.parser.parse(email.subject, email.body, email.date))
      .filter((transaction): transaction is ParsedTransaction => transaction !== null);
  }
}
