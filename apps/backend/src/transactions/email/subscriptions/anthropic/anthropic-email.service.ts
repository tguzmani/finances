import { Injectable } from '@nestjs/common';
import { TransactionPlatform } from '@prisma/client';
import { BaseEmailService } from '../../base-email.service';
import { BankEmailConfig, IBankEmailService, ParsedTransaction, RawEmail } from '../../email.interfaces';
import { AnthropicParser } from './anthropic.parser';

@Injectable()
export class AnthropicEmailService extends BaseEmailService implements IBankEmailService {
  private readonly ANTHROPIC_SENDER = 'invoice+statements@mail.anthropic.com';
  private readonly VALID_SUBJECTS = ['Your receipt from Anthropic, PBC'];

  constructor(private readonly parser: AnthropicParser) {
    super(AnthropicEmailService.name);
  }

  protected getBankConfig(): BankEmailConfig {
    return {
      sender: this.ANTHROPIC_SENDER,
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
