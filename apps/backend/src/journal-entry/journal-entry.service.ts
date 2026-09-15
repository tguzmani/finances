import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transaction } from '@prisma/client';
import { SheetsRepository } from '../common/sheets.repository';
import { BANESCO_MOVEMENT_EVENT, BanescoMovementEvent } from '../accounts/events/banesco-movement.event';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { JournalEntryLlmService } from './journal-entry-llm.service';
import { JournalEntryCacheService } from './journal-entry-cache.service';
import { LedgerRowService } from './ledger-row.service';
import { LedgerWriterService } from './ledger-writer.service';
import { formatLedgerDate } from './ledger-date';
import { SPLIT_SHARE, hasSplitMarker, stripSplitMarker } from './journal-entry.constants';

@Injectable()
export class JournalEntryService {
  private readonly logger = new Logger(JournalEntryService.name);

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly llmService: JournalEntryLlmService,
    private readonly cacheService: JournalEntryCacheService,
    private readonly ledgerRowService: LedgerRowService,
    private readonly ledgerWriter: LedgerWriterService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createJournalEntry(transaction: Transaction): Promise<void> {
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

    const usdAmount = isVes ? amount / exchangeRate : amount;
    const debeValue = isVes
      ? `=${amount.toFixed(2)}/${exchangeRate.toFixed(2)}`
      : amount.toFixed(2);

    // Debits share the expense; the single credit carries the full amount. A
    // description marked "+ Esther" splits it in two, so the row count varies.
    const cachedEntries = await this.cacheService.getCachedEntries(transaction.id);
    const cachedDebits = cachedEntries?.filter((e) => e.type === 'DEBIT') ?? [];
    const cachedCredit = cachedEntries?.find((e) => e.type === 'CREDIT');

    let debits: { account: string; category: string; subcategory: string }[];
    let creditAccount: string;

    if (cachedDebits.length > 0 && cachedCredit) {
      debits = cachedDebits;
      creditAccount = cachedCredit.account;
      this.logger.log(`Using cached classification for transaction ${transaction.id}`);
    } else {
      this.logger.log(`No cache found, calling LLM for transaction ${transaction.id}`);
      const description = transaction.description || '';
      const classification = await this.llmService.classify(
        stripSplitMarker(description) || 'No description',
        usdAmount,
        transaction.type,
        transaction.platform,
      );

      debits = [{
        account: classification.debit_account,
        category: classification.category,
        subcategory: classification.subcategory,
      }];
      if (hasSplitMarker(description)) {
        debits.push({ ...SPLIT_SHARE });
      }
      creditAccount = classification.credit_account;
    }

    const dateFormatted = formatLedgerDate(transaction.date);
    const creditRow = nextRow + debits.length;

    // The first debit takes an equal share of the credit; the rest mirror it, so
    // editing the credit in the sheet keeps every share in step.
    const rows = debits.map((debit, index) => [
      index === 0 ? dateFormatted : '',
      index === 0 ? stripSplitMarker(transaction.description || '') : '',
      debit.account,
      '',
      index === 0
        ? (debits.length > 1 ? `=G${creditRow}/${debits.length}` : `=G${creditRow}`)
        : `=F${nextRow}`,
      '',
      debit.category,
      debit.subcategory,
      '',
      '',
    ]);

    rows.push(['', '', '', creditAccount, '', debeValue, '', '', '', '']);

    const range = `Libro!B${nextRow}:K${nextRow + rows.length - 1}`;
    this.logger.log(`Inserting journal entry at ${range}`);
    await this.ledgerWriter.writeEntry(range, rows);
    this.logger.log(`Journal entry inserted for transaction ${transaction.id}`);
  }

  async createExchangeJournalEntry(sumFormula: string, wavg: number): Promise<void> {
    const nextRow = await this.ledgerRowService.getNextRow();

    const dateFormatted = formatLedgerDate(new Date());

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
    await this.ledgerWriter.writeEntry(range, [row1, row2]);
    this.logger.log(`Exchange journal entry inserted: Binance a Banesco`);

    this.eventEmitter.emit(
      BANESCO_MOVEMENT_EVENT,
      new BanescoMovementEvent('Binance a Banesco'),
    );
  }

}
