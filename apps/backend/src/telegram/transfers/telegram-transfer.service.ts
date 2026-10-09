import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SheetsRepository } from '../../common/sheets.repository';
import { BANESCO_MOVEMENT_EVENT, BanescoMovementEvent } from '../../accounts/events/banesco-movement.event';
import { touchesBanesco } from '../../journal-entry/journal-entry.constants';
import { fold } from '../../journal-entry/keyword-match';
import { OpenRouterService } from '../../common/open-router.service';
import { JournalEntryBuilder } from '../../journal-entry/journal-entry.builder';
import { LedgerRowService } from '../../journal-entry/ledger-row.service';
import { LedgerWriterService } from '../../journal-entry/ledger-writer.service';
import { formatLedgerDate } from '../../journal-entry/ledger-date';
import { REAL_ACCOUNTS } from '../../accounts/account.constants';
import { TRANSFER_RULES, TransferRule } from './transfer.rules';

@Injectable()
export class TelegramTransferService {
  private readonly logger = new Logger(TelegramTransferService.name);

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly openRouter: OpenRouterService,
    private readonly ledgerRowService: LedgerRowService,
    private readonly ledgerWriter: LedgerWriterService,
    private readonly eventEmitter: EventEmitter2,
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

  /**
   * Writes the amount onto the template row the rule names, and returns the
   * cell it used.
   *
   * Throws when the row is gone, which happens when the month's template drops
   * it. Writing to a guessed row would land the amount on someone else's entry.
   */
  async applyCellUpdate(rule: TransferRule, amount: number): Promise<string> {
    const row = await this.findRuleRow(rule);

    if (!row) {
      throw new Error(
        `No row titled "${rule.description}" in ${rule.sheet}. Add it, or register the transfer as a journal entry.`,
      );
    }

    const fullRange = `${rule.sheet}!${rule.column}${row}`;
    this.logger.log(`Transfer rule "${rule.name}": writing ${amount} to ${fullRange}`);
    await this.sheetsRepository.updateSheetValues(fullRange, [[amount]]);
    return fullRange;
  }

  /**
   * First row whose description matches. The template sits above the entries
   * the bot appends, so the first hit is the template's own row even when a
   * later entry happens to carry the same description.
   */
  private async findRuleRow(rule: TransferRule): Promise<number | null> {
    const values = await this.sheetsRepository.getSheetValues(`${rule.sheet}!C1:C60`);
    if (!values) return null;

    const wanted = fold(rule.description);
    const index = values.findIndex((cells) => fold(String(cells?.[0] ?? '')) === wanted);

    return index === -1 ? null : index + 1;
  }

  async createJournalEntry(
    amount: number,
    debitAccount: string,
    creditAccount: string,
    description: string,
  ): Promise<void> {
    const nextRow = await this.ledgerRowService.getNextRow();
    const dateFormatted = formatLedgerDate(new Date());

    const builder = new JournalEntryBuilder(nextRow);
    const { rows, range } = builder
      .addDebitRow({
        date: dateFormatted,
        description,
        account: debitAccount,
      })
      .addCreditRow({
        account: creditAccount,
        value: amount.toFixed(2),
      })
      .build();

    this.logger.log(`Transfer: inserting journal entry at ${range}`);
    await this.ledgerWriter.writeEntry(range, rows);
    this.logger.log(
      `Transfer registered: debit=${debitAccount}, credit=${creditAccount}, $${amount.toFixed(2)}`,
    );

    if (touchesBanesco(debitAccount, creditAccount)) {
      this.eventEmitter.emit(
        BANESCO_MOVEMENT_EVENT,
        new BanescoMovementEvent(description),
      );
    }
  }

}
