import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExchangeRateSource } from '@prisma/client';
import { ExchangesBcvService } from './exchanges-bcv.service';
import { ExchangeRateService } from './exchange-rate.service';

@Injectable()
export class ExchangeRateBcvScheduler {
  private readonly logger = new Logger(ExchangeRateBcvScheduler.name);
  private isRunning = false;

  constructor(
    private readonly bcvService: ExchangesBcvService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Fetch and store BCV official exchange rate daily at 8:30 AM Venezuela time
   * Cron expression: '30 12 * * *' runs at 12:30 UTC (8:30 AM VET)
   */
  @Cron('30 12 * * *', {
    name: 'exchange-rate-bcv',
    timeZone: 'UTC',
    disabled: process.env.SCHEDULERS_ENABLED === 'false',
  })
  async handleBcvRateSync() {
    if (this.isRunning) {
      this.logger.warn('Previous BCV rate sync still running, skipping');
      return;
    }

    this.logger.log('[CRON] Starting BCV rate sync');
    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Fetch BCV USD exchange rate
      const rate = await this.bcvService.getUsdExchangeRate();

      if (rate === null) {
        this.logger.warn('[CRON] Failed to fetch BCV rate - service unavailable');
        return;
      }

      // Round to 2 decimal places (match database precision)
      const roundedRate = Math.round(rate * 100) / 100;

      // Store rate with BCV source
      await this.exchangeRateService.create(
        roundedRate,
        ExchangeRateSource.BCV
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `[CRON] BCV rate sync completed in ${duration}ms - ` +
        `Stored rate: ${roundedRate} VES/USD`
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[CRON] BCV rate sync failed after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack
      );
    } finally {
      this.isRunning = false;
    }
  }
}
