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
      // Fetch BCV USD and EUR exchange rates in parallel
      const [usdRate, eurRate] = await Promise.all([
        this.bcvService.getUsdExchangeRate(),
        this.bcvService.getEurExchangeRate(),
      ]);

      if (usdRate === null && eurRate === null) {
        this.logger.warn('[CRON] Failed to fetch BCV rates - service unavailable');
        return;
      }

      // Store USD rate
      if (usdRate !== null) {
        const roundedUsd = Math.round(usdRate * 100) / 100;
        await this.exchangeRateService.create(roundedUsd, ExchangeRateSource.BCV);
        this.logger.log(`[CRON] Stored BCV USD rate: ${roundedUsd} VES/USD`);
      } else {
        this.logger.warn('[CRON] Failed to fetch BCV USD rate');
      }

      // Store EUR rate
      if (eurRate !== null) {
        const roundedEur = Math.round(eurRate * 100) / 100;
        await this.exchangeRateService.create(roundedEur, ExchangeRateSource.BCV_EUR);
        this.logger.log(`[CRON] Stored BCV EUR rate: ${roundedEur} VES/EUR`);
      } else {
        this.logger.warn('[CRON] Failed to fetch BCV EUR rate');
      }

      const duration = Date.now() - startTime;
      this.logger.log(`[CRON] BCV rate sync completed in ${duration}ms`);

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
