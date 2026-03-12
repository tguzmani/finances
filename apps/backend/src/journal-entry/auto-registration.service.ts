import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { SheetsRepository } from '../common/sheets.repository';
import { OpenRouterService } from '../common/open-router.service';
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

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly openRouter: OpenRouterService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly ledgerCursor: LedgerRowCursorService,
  ) {}

  /**
   * Attempts to auto-register a transaction by matching its description
   * against known rules. If matched, creates a journal entry in Google Sheets.
   * Returns the result if auto-registered, null otherwise.
   * Caller is responsible for updating the transaction status.
   */
  async tryAutoRegister(transaction: Transaction): Promise<AutoRegistrationResult | null> {
    if (!transaction.description) return null;

    const rule = this.simpleMatch(transaction.description)
      ?? await this.llmMatch(transaction.description);

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

  private async llmMatch(description: string): Promise<AutoRegistrationRule | null> {
    if (description.length > 60) return null;

    const rulesList = AUTO_REGISTRATION_RULES
      .map((r, i) => `${i + 1}. ${r.patterns.join(' / ')}`)
      .join('\n');

    const prompt = `Given this transaction description: "${description}"

Does it match any of these known transaction types (considering possible typos/variations)?
${rulesList}

Respond with ONLY the number if it matches, or "none" if it doesn't match any.`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0, maxTokens: 10 },
      );

      const answer = response.trim();
      if (answer === 'none') return null;

      const index = parseInt(answer, 10);
      if (isNaN(index) || index < 1 || index > AUTO_REGISTRATION_RULES.length) return null;

      const rule = AUTO_REGISTRATION_RULES[index - 1];
      this.logger.log(`LLM match found: "${description}" → ${rule.name}`);
      return rule;
    } catch (error) {
      this.logger.error(`LLM match failed: ${error.message}`);
      return null;
    }
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
