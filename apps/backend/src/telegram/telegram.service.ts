import { Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { ExchangesService } from '../exchanges/exchanges.service';
import { TransactionStatus, TransactionSource, TransactionType } from '../transactions/transaction.types';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
  ) {}

  async getStatus(): Promise<string> {
    try {
      // Get all transactions and exchanges
      const [allTransactions, allExchanges] = await Promise.all([
        this.transactionsService.findAll({}).catch(err => {
          this.logger.error(`Failed to fetch transactions: ${err.message}`);
          return [];
        }),
        this.exchangesService.findAll({}).catch(err => {
          this.logger.error(`Failed to fetch exchanges: ${err.message}`);
          return [];
        }),
      ]);

      // Filter NEW Banesco transactions
      const newBanescoCount = allTransactions.filter(t =>
        t.status === TransactionStatus.NEW &&
        t.source === TransactionSource.BANESCO
      ).length;

      // Count NEW EXPENSE transactions pending review
      const pendingReviewCount = allTransactions.filter(t =>
        t.status === TransactionStatus.NEW &&
        t.type === TransactionType.EXPENSE
      ).length;

      // Count all exchanges
      const exchangesCount = allExchanges.length;

      return (
        `Hello!\n` +
        `You have ${newBanescoCount} new Banesco transactions\n` +
        `You have ${pendingReviewCount} expenses pending review\n` +
        `You have ${exchangesCount} Binance exchanges recorded`
      );
    } catch (error) {
      this.logger.error(`Status check failed: ${error.message}`);
      throw new Error('Error getting status');
    }
  }

  async getNextReviewTransaction() {
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

  formatTransactionForReview(transaction: any): string {
    const transactionDate = new Date(transaction.date);

    const dateString = transactionDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Caracas'
    });

    // Capitalize first letter
    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = transactionDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Caracas'
    });

    return (
      `<b>Transaction Review</b>\n` +
      `\n` +
      `${date}\n` +
      `Time: ${time}\n` +
      `Amount: ${transaction.currency} ${transaction.amount}`
    );
  }

  async getRecentTransactions(): Promise<string> {
    try {
      const allTransactions = await this.transactionsService.findAll({});

      // Filter only EXPENSE transactions
      const expenses = allTransactions.filter(t => t.type === TransactionType.EXPENSE);

      if (expenses.length === 0) {
        return '📭 No expenses recorded.';
      }

      // Take last 10 expenses
      const recent = expenses.slice(0, 10);

      let message = `💸 <b>Last ${recent.length} expenses:</b>\n\n`;

      recent.forEach((t) => {
        const statusIcon = t.status === 'NEW' ? '🆕' : t.status === 'REVIEWED' ? '👁' : '✅';
        const date = new Date(t.date).toLocaleDateString('es-VE', {
          timeZone: 'America/Caracas'
        });

        message += `💸 <b>${t.currency} ${t.amount}</b>\n`;
        message += `   ${statusIcon} ${t.status} | ${date}\n`;
        message += `   Source: ${t.source}\n`;
        if (t.description) {
          message += `   📝 ${t.description}\n`;
        }
        message += '\n';
      });

      return message;
    } catch (error) {
      this.logger.error(`Failed to get transactions: ${error.message}`);
      throw new Error('Error getting transactions');
    }
  }

  async getRecentExchanges(): Promise<string> {
    try {
      const exchanges = await this.exchangesService.findAll({});

      if (exchanges.length === 0) {
        return '📭 No exchanges recorded.';
      }

      // Take last 10 exchanges
      const recent = exchanges.slice(0, 10);

      let message = `💱 <b>Last ${recent.length} exchanges:</b>\n\n`;

      recent.forEach((e) => {
        const icon = e.tradeType === 'SELL' ? '💵' : '🪙';
        const date = new Date(e.binanceCreatedAt).toLocaleDateString('es-VE', {
          timeZone: 'America/Caracas'
        });

        message += `${icon} <b>${e.asset} ${e.amount}</b>\n`;
        message += `   → ${e.fiatSymbol} ${e.fiatAmount}\n`;
        message += `   Rate: ${e.exchangeRate} | ${date}\n`;
        message += `   Status: ${e.status}\n`;
        if (e.counterparty) {
          message += `   👤 ${e.counterparty}\n`;
        }
        message += '\n';
      });

      return message;
    } catch (error) {
      this.logger.error(`Failed to get exchanges: ${error.message}`);
      throw new Error('Error getting exchanges');
    }
  }

  async triggerSync(): Promise<string> {
    try {
      this.logger.log('Manual sync triggered via Telegram bot');

      const results = await Promise.allSettled([
        this.transactionsService.syncFromEmail(10),
        this.exchangesService.syncFromBinance({ limit: 10, tradeType: 'SELL' as any }),
      ]);

      let message = '✅ <b>Sync completed:</b>\n\n';

      // Transactions
      if (results[0].status === 'fulfilled') {
        const txResult = results[0].value;
        message += `📧 <b>Transactions (Email):</b>\n`;
        message += `   Processed: ${txResult.emailsProcessed}\n`;
        message += `   Created: ${txResult.transactionsCreated}\n`;
        message += `   Skipped: ${txResult.transactionsSkipped}\n\n`;
      } else {
        message += `❌ Transactions error: ${results[0].reason}\n\n`;
      }

      // Exchanges
      if (results[1].status === 'fulfilled') {
        const exResult = results[1].value;
        message += `💱 <b>Exchanges (Binance):</b>\n`;
        message += `   Fetched: ${exResult.exchangesFetched}\n`;
        message += `   Created: ${exResult.exchangesCreated}\n`;
        message += `   Skipped: ${exResult.exchangesSkipped}\n`;
        message += `   Transactions: ${exResult.transactionsCreated}\n`;
        if (exResult.errors.length > 0) {
          message += `   ⚠️ Errors: ${exResult.errors.length}\n`;
        }
      } else {
        message += `❌ Exchanges error: ${results[1].reason}\n`;
      }

      return message;
    } catch (error) {
      this.logger.error(`Sync trigger failed: ${error.message}`);
      throw new Error('Error syncing data');
    }
  }
}
