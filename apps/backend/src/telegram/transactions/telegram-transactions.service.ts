import { Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../../transactions/transactions.service';
import { TelegramTransactionsPresenter } from './telegram-transactions.presenter';
import { TransactionStatus, TransactionType } from '../../transactions/transaction.types';

@Injectable()
export class TelegramTransactionsService {
  private readonly logger = new Logger(TelegramTransactionsService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
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

  async getRecentTransactionsList(): Promise<string> {
    try {
      const allTransactions = await this.transactionsService.findAll({});
      const expenses = allTransactions.filter(t => t.type === TransactionType.EXPENSE);
      return this.presenter.formatRecentList(expenses);
    } catch (error) {
      this.logger.error(`Failed to get transactions list: ${error.message}`);
      throw new Error('Error getting transactions');
    }
  }

  formatTransactionForReview(transaction: any): string {
    return this.presenter.formatForReview(transaction);
  }
}
