import { Injectable } from '@nestjs/common';
import { TransactionPlatform } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { GooglePlayParser } from './google-play.parser';

@Injectable()
export class GooglePlayEmailService extends BaseEmailService implements IBankEmailService {
  private readonly GOOGLE_PLAY_SENDER = 'googleplay-noreply@google.com';
  private readonly VALID_SUBJECTS = ['Your Google Play Order Receipt from'];

  constructor(private readonly parser: GooglePlayParser) {
    super(GooglePlayEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.GOOGLE_PLAY_SENDER,
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
