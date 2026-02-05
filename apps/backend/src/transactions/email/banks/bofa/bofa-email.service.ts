import { Injectable } from '@nestjs/common';
import { TransactionPlatform } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { BofaParser } from './bofa.parser';

@Injectable()
export class BofaEmailService extends BaseEmailService implements IBankEmailService {
  private readonly BOFA_SENDER = 'onlinebanking@ealerts.bankofamerica.com';
  private readonly VALID_SUBJECTS = ['Zelle® payment of $'];

  constructor(private readonly bofaParser: BofaParser) {
    super(BofaEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.BOFA_SENDER,
      subjectPatterns: this.VALID_SUBJECTS,
    };
  }

  getBankPlatform(): TransactionPlatform {
    return TransactionPlatform.BANK_OF_AMERICA;
  }

  parseEmails(emails: RawEmail[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (const email of emails) {
      const parsed = this.bofaParser.parse(email.subject, email.body, email.date);

      if (parsed) {
        transactions.push(parsed);
      }
    }

    return transactions;
  }
}
