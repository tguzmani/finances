import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { TransactionsService } from '../../transactions/transactions.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TelegramTransactionsPresenter } from './telegram-transactions.presenter';
import { TransactionStatus, TransactionType } from '../../transactions/transaction.types';

@Injectable()
export class TelegramTransactionsService {
  private readonly logger = new Logger(TelegramTransactionsService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly presenter: TelegramTransactionsPresenter,
  ) {}

  async getNextForReview() {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.find(t =>
        t.status === TransactionStatus.NEW &&
        t.type === TransactionType.EXPENSE
      );
    } catch (error) {
      this.logger.error(`Failed to get next review transaction: ${error.message}`);
      throw error;
    }
  }

  async getPendingReviewCount(): Promise<number> {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.filter(t =>
        t.status === TransactionStatus.NEW &&
        t.type === TransactionType.EXPENSE
      ).length;
    } catch (error) {
      this.logger.error(`Failed to count pending reviews: ${error.message}`);
      return 0;
    }
  }

  async getRecentTransactionsList(showAll = false): Promise<string> {
    try {
      const [allTransactions, latestRate] = await Promise.all([
        this.transactionsService.findAll({}),
        this.exchangeRateService.findLatest(),
      ]);

      let expenses = allTransactions.filter(t => t.type === TransactionType.EXPENSE);

      // Filter out rejected by default
      if (!showAll) {
        expenses = expenses.filter(t => t.status !== TransactionStatus.REJECTED);
      }

      const exchangeRate = latestRate ? Number(latestRate.value) : undefined;

      return this.presenter.formatRecentList(expenses, exchangeRate);
    } catch (error) {
      this.logger.error(`Failed to get transactions list: ${error.message}`);
      throw new Error('Error getting transactions');
    }
  }

  async formatTransactionForReview(transaction: Transaction): Promise<string> {
    try {
      const latestRate = await this.exchangeRateService.findLatest();
      const exchangeRate = latestRate ? Number(latestRate.value) : undefined;
      return this.presenter.formatForReview(transaction, exchangeRate);
    } catch (error) {
      this.logger.error(`Failed to format transaction: ${error.message}`);
      return this.presenter.formatForReview(transaction);
    }
  }

  // Register flow methods
  async hasNewTransactions(): Promise<boolean> {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.some(t =>
        t.status === TransactionStatus.NEW &&
        t.type === TransactionType.EXPENSE
      );
    } catch (error) {
      this.logger.error(`Failed to check new transactions: ${error.message}`);
      return false;
    }
  }

  async getReviewedTransactions(): Promise<Transaction[]> {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.filter(t =>
        t.status === TransactionStatus.REVIEWED &&
        t.type === TransactionType.EXPENSE
      );
    } catch (error) {
      this.logger.error(`Failed to get reviewed transactions: ${error.message}`);
      throw error;
    }
  }

  async registerTransactions(transactionIds: number[]): Promise<void> {
    try {
      await Promise.all(
        transactionIds.map(id =>
          this.transactionsService.update(id, {
            status: TransactionStatus.REGISTERED,
          })
        )
      );

      this.logger.log(`Registered ${transactionIds.length} transactions`);
    } catch (error) {
      this.logger.error(`Failed to register transactions: ${error.message}`);
      throw error;
    }
  }

  async getRegistrationData() {
    try {
      const [transactions, latestRate] = await Promise.all([
        this.getReviewedTransactions(),
        this.exchangeRateService.findLatest(),
      ]);

      // Sort transactions in ascending order (oldest first) for registration
      const sortedTransactions = transactions.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        transactions: sortedTransactions,
        exchangeRate: latestRate ? Number(latestRate.value) : null,
        hasTransactions: sortedTransactions.length > 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get registration data: ${error.message}`);
      throw error;
    }
  }

  formatTransactionForRegister(transaction: Transaction, exchangeRate: number): string {
    const transactionDate = new Date(transaction.date);

    const dateString = transactionDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });

    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = transactionDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    const vesAmount = Number(transaction.amount).toFixed(2);
    const usdAmount = (Number(transaction.amount) / exchangeRate).toFixed(2);

    return (
      `<b>${transaction.description || 'Transaction'}</b>\n\n` +
      `${date}\n` +
      `Time: ${time}\n\n` +
      `VES ${vesAmount}\n` +
      `USD ${usdAmount}`
    );
  }
}
