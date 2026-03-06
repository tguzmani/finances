import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionsService } from './transactions.service';
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
    } catch (err) {
      this.logger.error(`Binance sync failed: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
