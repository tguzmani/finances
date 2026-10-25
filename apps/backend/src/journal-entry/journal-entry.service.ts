import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { SheetsRepository } from '../common/sheets.repository';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { JournalEntryLlmService } from './journal-entry-llm.service';
import { JournalEntryCacheService } from './journal-entry-cache.service';
import { LedgerRowService } from './ledger-row.service';
import { LedgerWriterService } from './ledger-writer.service';
import { formatLedgerDate } from './ledger-date';
import { readSplit, stripSplitMarker } from './journal-entry.constants';

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

    // Every figure reaches the sheet in USD. A VES one is written as the
    // division, so the rate it was booked at stays visible in the cell.
    const inSheetCurrency = (value: number) =>
      isVes ? `=${value.toFixed(2)}/${exchangeRate.toFixed(2)}` : value.toFixed(2);

    const debeValue = inSheetCurrency(amount);

    const split = readSplit(transaction.description || '');
    const namedShare = split ? split.classifiedAmount ?? split.shareAmount : null;

    // A named share above what was spent would leave the other row negative, so
    // the entry is refused instead of written. Checked before the classifier
    // runs, since nothing about it can be salvaged.
    if (namedShare != null && namedShare > amount) {
      throw new Error(
        `Split of ${namedShare.toFixed(2)} ${transaction.currency} is more than the ${amount.toFixed(2)} spent`,
      );
    }

    // Debits share the expense; the single credit carries the full amount. A
    // split marker adds a second debit, so the row count varies.
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
      if (split) {
        debits.push({ ...split.share });
      }
      creditAccount = classification.credit_account;
    }

    const dateFormatted = formatLedgerDate(transaction.date);
    const shareRow = nextRow + 1;
    const creditRow = nextRow + debits.length;

    // The side the marker named takes exactly that figure and the other takes
    // what the credit has left; unnamed, the two are halves. Every row is
    // written against the credit or against its sibling, so editing the credit
    // in the sheet keeps the shares in step with it.
    const isSplit = debits.length > 1;
    const classifiedAmount = isSplit ? split?.classifiedAmount ?? null : null;
    const shareAmount = isSplit ? split?.shareAmount ?? null : null;

    let firstDebe: string;
    let shareDebe: string;

    if (!isSplit) {
      firstDebe = `=G${creditRow}`;
      shareDebe = '';
    } else if (classifiedAmount != null) {
      firstDebe = inSheetCurrency(classifiedAmount);
      shareDebe = `=G${creditRow}-F${nextRow}`;
    } else if (shareAmount != null) {
      firstDebe = `=G${creditRow}-F${shareRow}`;
      shareDebe = inSheetCurrency(shareAmount);
    } else {
      firstDebe = `=G${creditRow}/${debits.length}`;
      shareDebe = `=F${nextRow}`;
    }

    const rows = debits.map((debit, index) => [
      index === 0 ? dateFormatted : '',
      index === 0 ? stripSplitMarker(transaction.description || '') : '',
      debit.account,
      '',
      index === 0 ? firstDebe : shareDebe,
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
  }

}
