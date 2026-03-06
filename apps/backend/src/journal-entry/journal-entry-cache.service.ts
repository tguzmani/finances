import { Injectable, Logger } from '@nestjs/common';
import { JournalEntry, Transaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JournalEntryLlmService, JournalClassification } from './journal-entry-llm.service';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { JOURNAL_ACCOUNTS, PLATFORM_TO_ACCOUNT } from './journal-entry.constants';

// Asset and liability accounts only (exclude Gastos, Ingresos, Patrimonio)
const TRANSFER_ACCOUNTS = JOURNAL_ACCOUNTS
  .filter((a) => !a.startsWith('Gastos') && !a.startsWith('Ingresos') && a !== 'Patrimonio')
  .sort((a, b) => b.length - a.length); // longer names first to avoid false partials

@Injectable()
export class JournalEntryCacheService {
  private readonly logger = new Logger(JournalEntryCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: JournalEntryLlmService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async classifyAndCache(transaction: Transaction): Promise<void> {
    if (!transaction.description) {
      this.logger.debug(`Skipping classification for transaction ${transaction.id} (no description)`);
      return;
    }

    let classification: JournalClassification;

    if (transaction.type === 'TRANSFER') {
      const transferResult = this.classifyTransfer(transaction);
      if (transferResult) {
        classification = transferResult;
        this.logger.log(`Deterministic transfer classification for transaction ${transaction.id}: debit=${classification.debit_account}, credit=${classification.credit_account}`);
      } else {
        this.logger.log(`Transfer classification fallback to LLM for transaction ${transaction.id}`);
        classification = await this.classifyViaLlm(transaction);
      }
    } else {
      classification = await this.classifyViaLlm(transaction);
    }

    // Delete existing entries (idempotent re-classification)
    await this.prisma.journalEntry.deleteMany({
      where: { transactionId: transaction.id },
    });

    // Create DEBIT and CREDIT rows
    await this.prisma.journalEntry.createMany({
      data: [
        {
          transactionId: transaction.id,
          type: 'DEBIT',
          account: classification.debit_account,
          category: classification.category,
          subcategory: classification.subcategory,
        },
        {
          transactionId: transaction.id,
          type: 'CREDIT',
          account: classification.credit_account,
          category: '',
          subcategory: '',
        },
      ],
    });

    this.logger.log(`Cached journal entries for transaction ${transaction.id}: debit=${classification.debit_account}, credit=${classification.credit_account}`);
  }

  private classifyTransfer(transaction: Transaction): JournalClassification | null {
    const debitAccount = PLATFORM_TO_ACCOUNT[transaction.platform];
    if (!debitAccount) return null;

    const desc = (transaction.description || '').toLowerCase();
    const creditAccount = TRANSFER_ACCOUNTS.find(
      (account) => account !== debitAccount && desc.includes(account.toLowerCase()),
    );
    if (!creditAccount) return null;

    return {
      debit_account: debitAccount,
      credit_account: creditAccount,
      category: '',
      subcategory: '',
    };
  }

  private async classifyViaLlm(transaction: Transaction): Promise<JournalClassification> {
    const amount = Number(transaction.amount);
    const isVes = transaction.currency === 'VES';

    let usdAmount = amount;
    if (isVes) {
      const latestRate = await this.exchangeRateService.findLatest();
      const exchangeRate = latestRate ? Number(latestRate.value) : 0;
      if (!exchangeRate) {
        throw new Error(`No exchange rate available for VES conversion (transaction ${transaction.id})`);
      }
      usdAmount = amount / exchangeRate;
    }

    return this.llmService.classify(
      transaction.description || 'No description',
      usdAmount,
      transaction.type,
      transaction.platform,
    );
  }

  async getCachedEntries(transactionId: number): Promise<JournalEntry[] | null> {
    const entries = await this.prisma.journalEntry.findMany({
      where: { transactionId },
    });
    return entries.length > 0 ? entries : null;
  }

  async deleteCachedEntries(transactionId: number): Promise<void> {
    await this.prisma.journalEntry.deleteMany({
      where: { transactionId },
    });
  }
}
