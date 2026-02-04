import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionsService } from './transactions.service';

@Injectable()
export class TransactionsScheduler {
  private readonly logger = new Logger(TransactionsScheduler.name);
  private isRunning = false;

  constructor(private readonly transactionsService: TransactionsService) {}

  @Cron(process.env.TRANSACTIONS_SYNC_CRON || CronExpression.EVERY_10_MINUTES, {
    name: 'transactions-email-sync',
    disabled: process.env.SCHEDULERS_ENABLED === 'false',
  })
  async handleTransactionsSync() {
    // Prevenir ejecuciones concurrentes
    if (this.isRunning) {
      this.logger.warn('Previous sync still running, skipping this execution');
      return;
    }

    const limit = parseInt(process.env.TRANSACTIONS_SYNC_LIMIT || '30', 10);

    this.logger.log(`[CRON] Starting email sync (limit: ${limit})`);
    this.isRunning = true;
    const startTime = Date.now();

    try {
      const result = await this.transactionsService.syncFromEmail(limit);

      const duration = Date.now() - startTime;
      this.logger.log(
        `[CRON] Sync completed in ${duration}ms - ` +
        `Emails: ${result.emailsProcessed}, ` +
        `Created: ${result.transactionsCreated}, ` +
        `Skipped: ${result.transactionsSkipped}`
      );

      // Alerta si no se procesaron emails (posible problema de conexión)
      if (result.emailsProcessed === 0) {
        this.logger.warn('[CRON] No emails processed - check IMAP connection');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[CRON] Sync failed after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack
      );

      // No lanzamos error - el scheduler continúa en la siguiente iteración
    } finally {
      this.isRunning = false;
    }
  }
}
