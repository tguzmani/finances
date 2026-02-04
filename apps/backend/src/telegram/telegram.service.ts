import { Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { ExchangesService } from '../exchanges/exchanges.service';
import { TelegramExchangesService } from './exchanges/telegram-exchanges.service';
import { TelegramTransactionsService } from './transactions/telegram-transactions.service';
import { TransactionStatus, TransactionPlatform } from '../transactions/transaction.types';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
    private readonly telegramExchanges: TelegramExchangesService,
    private readonly telegramTransactions: TelegramTransactionsService,
  ) {}

  async getStatus(): Promise<string> {
    try {
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

      const newBanescoCount = allTransactions.filter(t =>
        t.status === TransactionStatus.NEW &&
        t.platform === TransactionPlatform.BANESCO
      ).length;

      const pendingReviewCount = await this.telegramTransactions.getPendingReviewCount();
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

  async triggerSync(): Promise<string> {
    try {
      this.logger.log('Manual sync triggered via Telegram bot');

      const results = await Promise.allSettled([
        this.transactionsService.syncFromEmail(10),
        this.exchangesService.syncFromBinance({ limit: 10, tradeType: 'SELL' as any }),
      ]);

      let message = '✅ <b>Sync completed:</b>\n\n';

      if (results[0].status === 'fulfilled') {
        const txResult = results[0].value;
        message += `📧 <b>Transactions (Email):</b>\n`;
        message += `   Processed: ${txResult.emailsProcessed}\n`;
        message += `   Created: ${txResult.transactionsCreated}\n`;
        message += `   Skipped: ${txResult.transactionsSkipped}\n\n`;
      } else {
        message += `❌ Transactions error: ${results[0].reason}\n\n`;
      }

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

  // Delegate to specialized services
  get exchanges() {
    return this.telegramExchanges;
  }

  get transactions() {
    return this.telegramTransactions;
  }
}
