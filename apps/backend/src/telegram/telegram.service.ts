import { Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { ExchangesService } from '../exchanges/exchanges.service';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { TelegramExchangesService } from './exchanges/telegram-exchanges.service';
import { TelegramTransactionsService } from './transactions/telegram-transactions.service';
import { TransactionStatus } from '../transactions/transaction.types';
import { ExchangeStatus } from '@prisma/client';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly telegramExchanges: TelegramExchangesService,
    private readonly telegramTransactions: TelegramTransactionsService,
  ) {}

  async getStatus(): Promise<string> {
    try {
      const [allTransactions, allExchanges, latestRate] = await Promise.all([
        this.transactionsService.findAll({}).catch(err => {
          this.logger.error(`Failed to fetch transactions: ${err.message}`);
          return [];
        }),
        this.exchangesService.findAll({}).catch(err => {
          this.logger.error(`Failed to fetch exchanges: ${err.message}`);
          return [];
        }),
        this.exchangeRateService.findLatest().catch(err => {
          this.logger.error(`Failed to fetch exchange rate: ${err.message}`);
          return null;
        }),
      ]);

      // Count transactions by status (both EXPENSE and INCOME)
      const txNew = allTransactions.filter(t => t.status === TransactionStatus.NEW).length;
      const txReviewed = allTransactions.filter(t => t.status === TransactionStatus.REVIEWED).length;
      const txRegistered = allTransactions.filter(t => t.status === TransactionStatus.REGISTERED).length;
      const txRejected = allTransactions.filter(t => t.status === TransactionStatus.REJECTED).length;

      const txTotal = txNew + txReviewed + txRegistered + txRejected;
      const txDone = txRegistered + txRejected;
      const txDonePercent = txTotal > 0 ? ((txDone / txTotal) * 100).toFixed(2) : '0.00';

      // Count exchanges by status
      const exNew = allExchanges.filter(e =>
        e.status === ExchangeStatus.COMPLETED || e.status === ExchangeStatus.PENDING
      ).length;
      const exReviewed = allExchanges.filter(e => e.status === ExchangeStatus.REVIEWED).length;
      const exRegistered = allExchanges.filter(e => e.status === ExchangeStatus.REGISTERED).length;
      const exRejected = allExchanges.filter(e => e.status === ExchangeStatus.REJECTED).length;

      const exTotal = exNew + exReviewed + exRegistered + exRejected;
      const exDone = exRegistered + exRejected;
      const exDonePercent = exTotal > 0 ? ((exDone / exTotal) * 100).toFixed(2) : '0.00';

      // Build status message
      let message = `<b>Transactions</b>\n`;
      message += `- New: ${txNew}\n`;
      message += `- Reviewed: ${txReviewed}\n`;
      message += `- Registered: ${txRegistered}\n`;
      message += `- Rejected: ${txRejected}\n`;
      message += `- Done: ${txDone} / ${txTotal} (${txDonePercent}%)\n\n`;

      message += `<b>Exchanges</b>\n`;
      message += `- New: ${exNew}\n`;
      message += `- Reviewed: ${exReviewed}\n`;
      message += `- Registered: ${exRegistered}\n`;
      message += `- Rejected: ${exRejected}\n`;
      message += `- Done: ${exDone} / ${exTotal} (${exDonePercent}%)\n\n`;

      message += `<b>Exchange Rate</b>\n`;
      if (latestRate) {
        message += `${Number(latestRate.value).toFixed(2)} VES/USD`;
      } else {
        message += `Not available`;
      }

      return message;
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
        this.transactionsService.syncFromBinance(10),
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
        message += `❌ Transactions (Email) error: ${results[0].reason}\n\n`;
      }

      if (results[1].status === 'fulfilled') {
        const binanceTxResult = results[1].value;
        message += `💰 <b>Transactions (Binance):</b>\n`;
        message += `   Fetched: ${binanceTxResult.totalFetched}\n`;
        message += `   Created: ${binanceTxResult.transactionsCreated}\n`;
        message += `   Skipped: ${binanceTxResult.transactionsSkipped}\n\n`;
      } else {
        message += `❌ Transactions (Binance) error: ${results[1].reason}\n\n`;
      }

      if (results[2].status === 'fulfilled') {
        const exResult = results[2].value;
        message += `💱 <b>Exchanges (Binance P2P):</b>\n`;
        message += `   Fetched: ${exResult.exchangesFetched}\n`;
        message += `   Created: ${exResult.exchangesCreated}\n`;
        message += `   Skipped: ${exResult.exchangesSkipped}\n`;
        if (exResult.errors.length > 0) {
          message += `   ⚠️ Errors: ${exResult.errors.length}\n`;
        }
      } else {
        message += `❌ Exchanges error: ${results[2].reason}\n`;
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
