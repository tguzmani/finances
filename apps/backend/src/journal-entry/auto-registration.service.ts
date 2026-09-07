import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { SheetsRepository } from '../common/sheets.repository';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { containsAllKeywords } from './keyword-match';
import { PLATFORM_TO_ACCOUNT } from './journal-entry.constants';
import { JournalEntryBuilder } from './journal-entry.builder';
import { LedgerRowService } from './ledger-row.service';
import { LedgerWriterService } from './ledger-writer.service';
import { formatLedgerDate } from './ledger-date';
import { AUTO_REGISTRATION_RULES, AutoRegistrationRule } from './auto-registration.rules';

export interface AutoRegistrationResult {
  rule: AutoRegistrationRule;
  debitAccount: string;
  creditAccount: string;
}

@Injectable()
export class AutoRegistrationService {
  private readonly logger = new Logger(AutoRegistrationService.name);

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly ledgerRowService: LedgerRowService,
    private readonly ledgerWriter: LedgerWriterService,
  ) {}

  /**
   * Attempts to auto-register a transaction by matching its description
   * against known rules. If matched, creates a journal entry in Google Sheets.
   * Returns the result if auto-registered, null otherwise.
   * Caller is responsible for updating the transaction status.
   */
  async tryAutoRegister(transaction: Transaction): Promise<AutoRegistrationResult | null> {
    if (!transaction.description) return null;

    const rule = this.findRule(transaction.description);

    if (!rule) return null;

    const creditAccount = PLATFORM_TO_ACCOUNT[transaction.platform];
    if (!creditAccount) {
      this.logger.warn(`No platform-to-account mapping for ${transaction.platform}, skipping auto-registration`);
      return null;
    }

    await this.createJournalEntry(transaction, rule, creditAccount);

    return { rule, debitAccount: rule.debitAccount, creditAccount };
  }

  private findRule(description: string): AutoRegistrationRule | null {
    // Every keyword has to be present: they name the parts of one description
    // ("gasolina" + "lancer"), so a single one on its own means nothing.
    const rule = AUTO_REGISTRATION_RULES.find((candidate) =>
      containsAllKeywords(description, candidate.keywords),
    );

    if (rule) {
      this.logger.log(`Matched "${description}" to rule ${rule.name}`);
    }

    return rule ?? null;
  }

  private async createJournalEntry(
    transaction: Transaction,
    rule: AutoRegistrationRule,
    creditAccount: string,
  ): Promise<void> {
    const amount = Number(transaction.amount);
    const isVes = transaction.currency === 'VES';

    const [latestRate, nextRow] = await Promise.all([
      isVes ? this.exchangeRateService.findLatest() : Promise.resolve(null),
      this.ledgerRowService.getNextRow(),
    ]);

    const exchangeRate = latestRate ? Number(latestRate.value) : 0;
    if (isVes && !exchangeRate) {
      throw new Error('Exchange rate not available for VES conversion');
    }

    const haberValue = isVes
      ? `=${amount.toFixed(2)}/${exchangeRate.toFixed(2)}`
      : amount.toFixed(2);

    const dateFormatted = formatLedgerDate(transaction.date);

    const builder = new JournalEntryBuilder(nextRow);
    const { rows, range } = builder
      .addDebitRow({
        date: dateFormatted,
        description: transaction.description || '',
        account: rule.debitAccount,
        category: rule.category,
        subcategory: rule.subcategory,
      })
      .addCreditRow({
        account: creditAccount,
        value: haberValue,
      })
      .build();

    this.logger.log(`Auto-registration: inserting journal entry at ${range}`);
    await this.ledgerWriter.writeEntry(range, rows);
    this.logger.log(`Auto-registered transaction ${transaction.id} via rule "${rule.name}"`);
  }

}
