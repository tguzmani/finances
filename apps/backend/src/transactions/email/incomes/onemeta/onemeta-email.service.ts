import { Injectable } from '@nestjs/common';
import { TransactionPlatform } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { OneMetaParser } from './onemeta.parser';

@Injectable()
export class OneMetaEmailService extends BaseEmailService implements IBankEmailService {
  private readonly ONEMETA_SENDER = 'listopay@listoglobal.com';
  private readonly VALID_SUBJECTS = ['Your money is on the way'];

  constructor(private readonly parser: OneMetaParser) {
    super(OneMetaEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.ONEMETA_SENDER,
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
