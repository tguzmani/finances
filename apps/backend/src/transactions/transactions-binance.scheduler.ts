import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionsService } from './transactions.service';
import { TransactionStatus } from './transaction.types';
import { NewTransactionsEvent } from './events/new-transactions.event';

@Injectable()
export class TransactionsBinanceScheduler {
  private readonly logger = new Logger(TransactionsBinanceScheduler.name);
  private isRunning = false;

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(process.env.BINANCE_TRANSACTIONS_SYNC_CRON || CronExpression.EVERY_10_MINUTES)
  async handleBinanceSync() {
    if (process.env.SCHEDULERS_ENABLED === 'false') {
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Binance sync already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const limit = parseInt(process.env.BINANCE_TRANSACTIONS_SYNC_LIMIT || '30', 10);
      const result = await this.transactionsService.syncFromBinance(limit);

      this.logger.log(
        `Binance sync completed: ${result.transactionsCreated} created, ${result.transactionsSkipped} skipped`
      );

      if (result.autoRegistered.length > 0) {
        const totalAmount = result.autoRegistered.reduce(
          (sum, t) => sum + Number(t.amount), 0
        );
        this.eventEmitter.emit(
          'transactions.auto-registered',
          new NewTransactionsEvent(
            result.autoRegistered,
            totalAmount,
            result.autoRegistered[0].currency
          )
        );
        this.logger.log(
          `[EVENT] Emitted auto-registered event for ${result.autoRegistered.length} Binance transactions`
        );
      }

      // Notify about new non-auto-registered transactions
      const newCount = result.transactionsCreated - result.autoRegistered.length;
      if (newCount > 0) {
        const allTransactions = await this.transactionsService.findAll({});
        const recentNew = allTransactions
          .filter(t => t.status === TransactionStatus.NEW)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, newCount);

        if (recentNew.length > 0) {
          const totalAmount = recentNew.reduce(
            (sum, t) => sum + Number(t.amount), 0
          );
          this.eventEmitter.emit(
            'transactions.new',
            new NewTransactionsEvent(
              recentNew,
              totalAmount,
              recentNew[0].currency
            )
          );
          this.logger.log(
            `[EVENT] Emitted NewTransactionsEvent for ${recentNew.length} Binance transactions`
          );
        }
      }
    } catch (err) {
      this.logger.error(`Binance sync failed: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
