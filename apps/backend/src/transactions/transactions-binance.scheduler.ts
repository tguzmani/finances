import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionsService } from './transactions.service';

@Injectable()
export class TransactionsBinanceScheduler {
  private readonly logger = new Logger(TransactionsBinanceScheduler.name);
  private isRunning = false;

  constructor(private readonly transactionsService: TransactionsService) {}

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
    } catch (err) {
      this.logger.error(`Binance sync failed: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
