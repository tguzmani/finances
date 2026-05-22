import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExchangeRateSource } from '@prisma/client';
import { ExchangesBinanceService } from './exchanges-binance.service';
import { ExchangeRateService } from './exchange-rate.service';

@Injectable()
export class ExchangeRateBinanceScheduler {
  private readonly logger = new Logger(ExchangeRateBinanceScheduler.name);
  private isRunning = false;

  constructor(
    private readonly binanceService: ExchangesBinanceService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Fetch and store Binance P2P exchange rate every 4 hours
   * Runs at: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
   */
  @Cron('0 */4 * * *', {
    name: 'exchange-rate-binance-p2p',
    timeZone: 'UTC',
    disabled: process.env.SCHEDULERS_ENABLED === 'false',
  })
  async handleBinanceP2PRateSync() {
    if (this.isRunning) {
      this.logger.warn('Previous Binance P2P rate sync still running, skipping');
      return;
    }

    this.logger.log('[CRON] Starting Binance P2P rate sync');
    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Fetch average P2P rate for VES/USDT (BUY side, top 10 offers)
      const rate = await this.binanceService.getAverageP2PRate(
        'VES',
        'USDT',
        'BUY',
        10
      );

      if (rate === null) {
        this.logger.warn('[CRON] Failed to fetch Binance P2P rate - no offers available');
        return;
      }

      // Round to 2 decimal places (match database precision)
      const roundedRate = Math.round(rate * 100) / 100;

      // Store rate with BINANCE_P2P source
      await this.exchangeRateService.create(
        roundedRate,
        ExchangeRateSource.BINANCE_P2P
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `[CRON] Binance P2P rate sync completed in ${duration}ms - ` +
        `Stored rate: ${roundedRate} VES/USDT`
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[CRON] Binance P2P rate sync failed after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack
      );
    } finally {
      this.isRunning = false;
    }
  }
}
