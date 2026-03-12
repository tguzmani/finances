import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../../common/sheets.repository';
import { OpenRouterService } from '../../common/open-router.service';
import { JournalEntryBuilder } from '../../journal-entry/journal-entry.builder';
import { LedgerRowCursorService } from '../../journal-entry/ledger-row-cursor.service';
import { REAL_ACCOUNTS } from '../../accounts/account.constants';
import { TRANSFER_RULES, TransferRule } from './transfer.rules';

@Injectable()
export class TelegramTransferService {
  private readonly logger = new Logger(TelegramTransferService.name);

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly openRouter: OpenRouterService,
    private readonly ledgerCursor: LedgerRowCursorService,
  ) {}

  async matchAccount(userInput: string): Promise<string | null> {
    const normalized = userInput.toLowerCase().trim();

    const exactMatch = REAL_ACCOUNTS.find(
      (a) => a.toLowerCase() === normalized,
    );
    if (exactMatch) return exactMatch;

    const containsMatch = REAL_ACCOUNTS.find(
      (a) =>
        a.toLowerCase().includes(normalized) ||
        normalized.includes(a.toLowerCase()),
    );
    if (containsMatch) return containsMatch;

    return this.llmMatchAccount(userInput);
  }

  private async llmMatchAccount(userInput: string): Promise<string | null> {
    const accountsList = REAL_ACCOUNTS.map((a, i) => `${i + 1}. ${a}`).join(
      '\n',
    );

    const prompt = `Given this user input: "${userInput}"

Which of these accounts does it refer to (considering possible typos, abbreviations, or Spanish/English variations)?
${accountsList}

Respond with ONLY the number if it matches, or "none" if it doesn't match any.`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0, maxTokens: 10 },
      );

      const answer = response.trim();
      if (answer === 'none') return null;

      const index = parseInt(answer, 10);
      if (isNaN(index) || index < 1 || index > REAL_ACCOUNTS.length)
        return null;

      return REAL_ACCOUNTS[index - 1];
    } catch (error) {
      this.logger.error(`LLM account match failed: ${error.message}`);
      return null;
    }
  }

  findTransferRule(debitAccount: string, creditAccount: string): TransferRule | null {
    return TRANSFER_RULES.find(
      (r) => r.debitAccount === debitAccount && r.creditAccount === creditAccount,
    ) ?? null;
  }

  async applyCellUpdate(rule: TransferRule, amount: number): Promise<void> {
    const fullRange = `${rule.sheet}!${rule.cell}`;
    this.logger.log(`Transfer rule "${rule.name}": writing ${amount} to ${fullRange}`);
    await this.sheetsRepository.updateSheetValues(fullRange, [[amount]]);
  }

  async createJournalEntry(
    amount: number,
    debitAccount: string,
    creditAccount: string,
    description: string,
  ): Promise<void> {
    const nextRow = await this.ledgerCursor.getNextRow();
    const dateFormatted = this.formatDate(new Date());

    const builder = new JournalEntryBuilder(nextRow);
    const { rows, range } = builder
      .addDebitRow({
        date: dateFormatted,
        description,
        account: debitAccount,
      })
      .addCreditRow({
        account: creditAccount,
        value: `$${amount.toFixed(2)}`,
      })
      .build();

    this.logger.log(`Transfer: inserting journal entry at ${range}`);
    await this.sheetsRepository.updateSheetValues(range, rows);
    this.ledgerCursor.advance(rows.length);
    this.logger.log(
      `Transfer registered: debit=${debitAccount}, credit=${creditAccount}, $${amount.toFixed(2)}`,
    );
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDate();
    const month = d.toLocaleDateString('en-US', {
      month: 'short',
      timeZone: 'UTC',
    });
    return `${day}-${month}`;
  }
}
