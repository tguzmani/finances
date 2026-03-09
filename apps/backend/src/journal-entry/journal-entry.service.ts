import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { SheetsRepository } from '../common/sheets.repository';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { JournalEntryLlmService } from './journal-entry-llm.service';
import { JournalEntryCacheService } from './journal-entry-cache.service';

@Injectable()
export class JournalEntryService {
  private readonly logger = new Logger(JournalEntryService.name);
  private readonly LEDGER_RANGE = 'Libro!B:K';

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly llmService: JournalEntryLlmService,
    private readonly cacheService: JournalEntryCacheService,
  ) {}

  async createJournalEntry(transaction: Transaction): Promise<void> {
    const amount = Number(transaction.amount);
    const isVes = transaction.currency === 'VES';

    const [latestRate, nextRow] = await Promise.all([
      isVes ? this.exchangeRateService.findLatest() : Promise.resolve(null),
      this.getNextRow(),
    ]);

    const exchangeRate = latestRate ? Number(latestRate.value) : 0;
    if (isVes && !exchangeRate) {
      throw new Error('Exchange rate not available for VES conversion');
    }

    const usdAmount = isVes ? amount / exchangeRate : amount;
    const debeValue = isVes
      ? `=${amount.toFixed(2)}/${exchangeRate.toFixed(2)}`
      : `$${amount.toFixed(2)}`;

    // Try cache first, fallback to LLM
    const cachedEntries = await this.cacheService.getCachedEntries(transaction.id);
    let classification;
    if (cachedEntries && cachedEntries.length === 2) {
      const debitEntry = cachedEntries.find((e) => e.type === 'DEBIT');
      const creditEntry = cachedEntries.find((e) => e.type === 'CREDIT');
      if (debitEntry && creditEntry) {
        classification = {
          debit_account: debitEntry.account,
          credit_account: creditEntry.account,
          category: debitEntry.category,
          subcategory: debitEntry.subcategory,
        };
        this.logger.log(`Using cached classification for transaction ${transaction.id}`);
      }
    }
    if (!classification) {
      this.logger.log(`No cache found, calling LLM for transaction ${transaction.id}`);
      classification = await this.llmService.classify(
        transaction.description || 'No description',
        usdAmount,
        transaction.type,
        transaction.platform,
      );
    }

    const dateFormatted = this.formatDate(transaction.date);

    // Row 1: Date | Description | Debe.1 | (empty) | Debe (=ref to Haber) | (empty) | Category | Subcategory | (empty) | (empty)
    const row1 = [
      dateFormatted,
      transaction.description || '',
      classification.debit_account,
      '',
      `=G${nextRow + 1}`,
      '',
      classification.category,
      classification.subcategory,
      '',
      '',
    ];

    // Row 2: (empty) | (empty) | (empty) | Haber.1 | (empty) | Haber (actual value) | (empty) ...
    const row2 = [
      '',
      '',
      '',
      classification.credit_account,
      '',
      debeValue,
      '',
      '',
      '',
      '',
    ];

    const range = `Libro!B${nextRow}:K${nextRow + 1}`;
    this.logger.log(`Inserting journal entry at ${range}`);
    await this.sheetsRepository.updateSheetValues(range, [row1, row2]);
    this.logger.log(`Journal entry inserted for transaction ${transaction.id}`);
  }

  async createExchangeJournalEntry(sumFormula: string, wavg: number): Promise<void> {
    const nextRow = await this.getNextRow();

    const dateFormatted = this.formatDate(new Date());

    // Row 1 (Debit): Banesco receives the money, Debe references Haber
    const row1 = [
      dateFormatted,
      'Binance a Banesco',
      'Banesco',
      '',
      `=G${nextRow + 1}`,
      '',
      '',
      '',
      '',
      '',
    ];

    // Row 2 (Credit): Binance sends the money, Haber has the actual value
    const row2 = [
      '',
      '',
      '',
      'Binance',
      '',
      sumFormula,
      '',
      '',
      '',
      '',
    ];

    const range = `Libro!B${nextRow}:K${nextRow + 1}`;
    this.logger.log(`Inserting exchange journal entry at ${range}`);
    await this.sheetsRepository.updateSheetValues(range, [row1, row2]);
    this.logger.log(`Exchange journal entry inserted: Binance a Banesco`);
  }

  private async getNextRow(): Promise<number> {
    const values = await this.sheetsRepository.getSheetValues(this.LEDGER_RANGE);
    const existingRows = values || [];
    return existingRows.length + 1;
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Caracas' });
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Caracas' });
    return `${day}-${month}`;
  }
}
