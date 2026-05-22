import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionsImageCleanupService } from './transactions-image-cleanup.service';

@Injectable()
export class TransactionsImageCleanupScheduler {
  private readonly logger = new Logger(TransactionsImageCleanupScheduler.name);
  private isRunning = false;

  constructor(
    private readonly cleanupService: TransactionsImageCleanupService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'transactions-image-cleanup',
    disabled: process.env.SCHEDULERS_ENABLED === 'false',
  })
  async handleImageCleanup() {
    if (this.isRunning) {
      this.logger.warn('Previous cleanup still running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.logger.log('[CRON] Starting orphaned image cleanup');

    try {
      const result = await this.cleanupService.cleanupOrphanedImages();
      const duration = Date.now() - startTime;
      this.logger.log(
        `[CRON] Cleanup completed in ${duration}ms - Deleted ${result.deletedImages}/${result.orphanedImages} orphaned images (${result.totalImages} total)`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[CRON] Image cleanup failed after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
