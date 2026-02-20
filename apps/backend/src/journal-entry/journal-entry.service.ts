import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { SheetsRepository } from '../common/sheets.repository';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { JournalEntryLlmService } from './journal-entry-llm.service';

@Injectable()
export class JournalEntryService {
  private readonly logger = new Logger(JournalEntryService.name);
  private readonly LEDGER_RANGE = 'Libro!B:K';

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly llmService: JournalEntryLlmService,
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

    const classification = await this.llmService.classify(
      transaction.description || 'No description',
      usdAmount,
      transaction.type,
      transaction.platform,
    );

    const dateFormatted = this.formatDate(transaction.date);

    // Row 1: Date | Description | Debe.1 | (empty) | Debe | (empty) | Category | Subcategory | (empty) | (empty)
    const row1 = [
      dateFormatted,
      transaction.description || '',
      classification.debit_account,
      '',
      debeValue,
      '',
      classification.category,
      classification.subcategory,
      '',
      '',
    ];

    // Row 2: (empty) | (empty) | (empty) | Haber.1 | (empty) | Haber (=formula) | (empty) ...
    const row2 = [
      '',
      '',
      '',
      classification.credit_account,
      '',
      `=F${nextRow}`,
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

    // Row 1 (Debit): Banesco receives the money
    const row1 = [
      dateFormatted,
      'Binance a Banesco',
      'Banesco',
      '',
      sumFormula,
      '',
      '',
      '',
      '',
      '',
    ];

    // Row 2 (Credit): Binance sends the money, Haber references Debe with formula
    const row2 = [
      '',
      '',
      '',
      'Binance',
      '',
      `=F${nextRow}`,
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
    const day = d.getUTCDate();
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${day}-${month}`;
  }
}
