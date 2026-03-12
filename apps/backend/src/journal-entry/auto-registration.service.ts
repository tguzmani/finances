import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import Fuse from 'fuse.js';
import { SheetsRepository } from '../common/sheets.repository';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { PLATFORM_TO_ACCOUNT } from './journal-entry.constants';
import { JournalEntryBuilder } from './journal-entry.builder';
import { LedgerRowCursorService } from './ledger-row-cursor.service';
import { AUTO_REGISTRATION_RULES, AutoRegistrationRule } from './auto-registration.rules';

export interface AutoRegistrationResult {
  rule: AutoRegistrationRule;
  debitAccount: string;
  creditAccount: string;
}

@Injectable()
export class AutoRegistrationService {
  private readonly logger = new Logger(AutoRegistrationService.name);
  private readonly fuse: Fuse<AutoRegistrationRule>;

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly ledgerCursor: LedgerRowCursorService,
  ) {
    this.fuse = new Fuse(AUTO_REGISTRATION_RULES, {
      keys: ['keywords', 'patterns'],
      threshold: 0.4,
      includeScore: true,
    });
  }

  /**
   * Attempts to auto-register a transaction by matching its description
   * against known rules. If matched, creates a journal entry in Google Sheets.
   * Returns the result if auto-registered, null otherwise.
   * Caller is responsible for updating the transaction status.
   */
  async tryAutoRegister(transaction: Transaction): Promise<AutoRegistrationResult | null> {
    if (!transaction.description) return null;

    const rule = this.simpleMatch(transaction.description)
      ?? this.fuzzyMatch(transaction.description);

    if (!rule) return null;

    const creditAccount = PLATFORM_TO_ACCOUNT[transaction.platform];
    if (!creditAccount) {
      this.logger.warn(`No platform-to-account mapping for ${transaction.platform}, skipping auto-registration`);
      return null;
    }

    await this.createJournalEntry(transaction, rule, creditAccount);

    return { rule, debitAccount: rule.debitAccount, creditAccount };
  }

  private simpleMatch(description: string): AutoRegistrationRule | null {
    const normalized = description.toLowerCase().trim();
    for (const rule of AUTO_REGISTRATION_RULES) {
      const allKeywordsMatch = rule.keywords.every(
        (keyword) => normalized.includes(keyword.toLowerCase()),
      );
      if (allKeywordsMatch) {
        this.logger.log(`Simple match found: "${description}" → ${rule.name}`);
        return rule;
      }
    }
    return null;
  }

  private fuzzyMatch(description: string): AutoRegistrationRule | null {
    const results = this.fuse.search(description);
    if (results.length === 0) return null;

    const best = results[0];
    if (best.score !== undefined && best.score > 0.4) return null;

    this.logger.log(`Fuzzy match found: "${description}" → ${best.item.name} (score: ${best.score?.toFixed(3)})`);
    return best.item;
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
      this.ledgerCursor.getNextRow(),
    ]);

    const exchangeRate = latestRate ? Number(latestRate.value) : 0;
    if (isVes && !exchangeRate) {
      throw new Error('Exchange rate not available for VES conversion');
    }

    const haberValue = isVes
      ? `=${amount.toFixed(2)}/${exchangeRate.toFixed(2)}`
      : `$${amount.toFixed(2)}`;

    const dateFormatted = this.formatDate(transaction.date);

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
    await this.sheetsRepository.updateSheetValues(range, rows);
    this.ledgerCursor.advance(rows.length);
    this.logger.log(`Auto-registered transaction ${transaction.id} via rule "${rule.name}"`);
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Caracas' });
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Caracas' });
    return `${day}-${month}`;
  }
}
