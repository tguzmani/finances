import { Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { ExchangesService } from '../exchanges/exchanges.service';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { TransactionStatus, TransactionPlatform, TransactionType } from '../transactions/transaction.types';
import { ExchangeStatus } from '@prisma/client';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
    private readonly exchangeRateService: ExchangeRateService,
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
        t.platform === TransactionPlatform.BANESCO
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

  async getNextReviewExchange() {
    try {
      const exchanges = await this.exchangesService.findAll({});
      return exchanges.find(e =>
        e.status === ExchangeStatus.COMPLETED ||
        e.status === ExchangeStatus.PENDING
      );
    } catch (error) {
      this.logger.error(`Failed to get next review exchange: ${error.message}`);
      throw error;
    }
  }

  async getPendingExchangesCount(): Promise<number> {
    try {
      const exchanges = await this.exchangesService.findAll({});
      return exchanges.filter(e =>
        e.status === ExchangeStatus.COMPLETED ||
        e.status === ExchangeStatus.PENDING
      ).length;
    } catch (error) {
      this.logger.error(`Failed to count pending exchanges: ${error.message}`);
      return 0;
    }
  }

  formatExchangeForReview(exchange: any): string {
    const exchangeDate = new Date(exchange.binanceCreatedAt);

    const dateString = exchangeDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Caracas'
    });

    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = exchangeDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Caracas'
    });

    const tradeType = exchange.tradeType === 'SELL' ? 'Sell' : 'Buy';
    const icon = exchange.tradeType === 'SELL' ? '💵' : '🪙';

    // Get last 4 digits of order number
    const last4Digits = exchange.orderNumber.slice(-4);

    return (
      `<b>Exchange Review</b>\n` +
      `\n` +
      `${icon} <b>${tradeType}: ${exchange.asset} ${exchange.amount}</b>\n` +
      `→ ${exchange.fiatSymbol} ${exchange.fiatAmount}\n` +
      `Rate: ${exchange.exchangeRate}\n` +
      `Order: ...${last4Digits}\n` +
      `${date}\n` +
      `Time: ${time}\n` +
      (exchange.counterparty ? `Counterparty: ${exchange.counterparty}\n` : '')
    );
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

      let message = `<b>Last ${recent.length} expenses:</b>\n\n`;

      recent.forEach((t) => {
        // Status icon mapping - no icon for reviewed
        const statusIcon =
          t.status === 'NEW' ? '🆕' :
          t.status === 'REJECTED' ? '❌' :
          t.status === 'REGISTERED' ? '✅' :
          '';

        // Status label mapping
        const statusLabel =
          t.status === 'NEW' ? 'New' :
          t.status === 'REVIEWED' ? 'Reviewed' :
          t.status === 'REJECTED' ? 'Rejected' :
          'Registered';

        // Platform label mapping
        const platformLabel = t.platform === 'BANESCO' ? 'Banesco' : t.platform;

        // Method label mapping
        const methodLabel = t.method
          ? (t.method === 'DEBIT_CARD' ? 'Debit Card' :
             t.method === 'PAGO_MOVIL' ? 'Pago Móvil' :
             t.method)
          : null;

        const transactionDate = new Date(t.date);
        const date = transactionDate.toLocaleDateString('es-VE', {
          timeZone: 'America/Caracas'
        });
        const time = transactionDate.toLocaleTimeString('es-VE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Caracas'
        });

        // If has description, show it as title with amount below
        if (t.description) {
          message += `<b>${t.description}</b>\n`;
          message += `   ${t.currency} ${t.amount}\n`;
          message += `   ${date} ${time}\n`;
          message += `   Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n`;
          message += `   ${statusIcon}${statusIcon ? ' ' : ''}${statusLabel}\n`;
        } else {
          // No description, show amount as title
          message += `<b>${t.currency} ${t.amount}</b>\n`;
          message += `   ${date} ${time}\n`;
          message += `   Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n`;
          message += `   ${statusIcon}${statusIcon ? ' ' : ''}${statusLabel}\n`;
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

      let message = `<b>Last ${recent.length} exchanges:</b>\n\n`;

      recent.forEach((e) => {
        const icon = e.tradeType === 'SELL' ? '💵' : '🪙';

        // Trade type label mapping
        const tradeTypeLabel = e.tradeType === 'SELL' ? 'Sell' : 'Buy';

        // Status label mapping
        const statusLabel =
          e.status === 'COMPLETED' ? 'Completed' :
          e.status === 'PROCESSING' ? 'Processing' :
          e.status === 'PENDING' ? 'Pending' :
          e.status === 'CANCELLED' ? 'Cancelled' :
          e.status === 'FAILED' ? 'Failed' :
          e.status === 'REVIEWED' ? 'Reviewed' :
          e.status === 'REJECTED' ? 'Rejected' :
          e.status === 'REGISTERED' ? 'Registered' :
          e.status;

        const date = new Date(e.binanceCreatedAt).toLocaleDateString('es-VE', {
          timeZone: 'America/Caracas'
        });

        message += `${icon} <b>${e.asset} ${e.amount}</b>\n`;
        message += `   → ${e.fiatSymbol} ${e.fiatAmount}\n`;
        message += `   Rate: ${e.exchangeRate} | ${date}\n`;
        message += `   Status: ${statusLabel} | ${tradeTypeLabel}\n`;
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

  async getReviewedExchanges() {
    try {
      const exchanges = await this.exchangesService.findAll({});
      return exchanges.filter(e => e.status === ExchangeStatus.REVIEWED);
    } catch (error) {
      this.logger.error(`Failed to get reviewed exchanges: ${error.message}`);
      throw error;
    }
  }

  calculateRegisterMetrics(exchanges: any[]) {
    // TLIST: Extract last 4 digits of order numbers
    const terminalList = exchanges
      .map(e => e.orderNumber.slice(-4))
      .join(', ');

    // WAVG: Weighted average
    const totalAmount = exchanges.reduce((sum, e) => sum + Number(e.amount), 0);
    const weightedSum = exchanges.reduce(
      (sum, e) => sum + Number(e.amount) * Number(e.exchangeRate),
      0
    );
    const wavg = Math.round(weightedSum / totalAmount);

    // SUM: Google Sheets formula
    const amounts = exchanges.map(e => Number(e.amount));
    const sumFormula = `=${amounts.join('+')}`;

    return { terminalList, wavg, sumFormula, totalAmount };
  }

  async registerExchanges(exchangeIds: number[], wavg: number): Promise<void> {
    try {
      // Update all exchanges to REGISTERED
      await Promise.all(
        exchangeIds.map(id =>
          this.exchangesService.update(id, {
            status: ExchangeStatus.REGISTERED,
          })
        )
      );

      // Save exchange rate
      await this.exchangeRateService.create(wavg);

      this.logger.log(`Registered ${exchangeIds.length} exchanges with WAVG ${wavg}`);
    } catch (error) {
      this.logger.error(`Failed to register exchanges: ${error.message}`);
      throw error;
    }
  }

  formatRegisterSummary(metrics: any): string {
    return (
      `<b>Register Exchanges</b>\n\n` +
      `📊 <b>Summary:</b>\n` +
      `Total exchanges: ${metrics.count}\n` +
      `Total USDT: ${metrics.totalAmount}\n` +
      `Weighted Avg Rate: ${metrics.wavg} VES/USDT\n\n` +
      `Use the buttons below to copy data:`
    );
  }
}
