import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExchangesService } from './exchanges.service';
import { TradeType } from './exchange.types';

@Injectable()
export class ExchangesScheduler {
  private readonly logger = new Logger(ExchangesScheduler.name);
  private isRunning = false;

  constructor(private readonly exchangesService: ExchangesService) {}

  @Cron(process.env.EXCHANGES_SYNC_CRON || CronExpression.EVERY_30_MINUTES, {
    name: 'exchanges-binance-sync',
    disabled: process.env.SCHEDULERS_ENABLED === 'false',
  })
  async handleExchangesSync() {
    // Prevenir ejecuciones concurrentes
    if (this.isRunning) {
      this.logger.warn('Previous sync still running, skipping this execution');
      return;
    }

    const limit = parseInt(process.env.EXCHANGES_SYNC_LIMIT || '30', 10);
    const tradeType = (process.env.EXCHANGES_SYNC_TRADE_TYPE || 'SELL') as TradeType;

    this.logger.log(`[CRON] Starting Binance sync (limit: ${limit}, tradeType: ${tradeType})`);
    this.isRunning = true;
    const startTime = Date.now();

    try {
      const result = await this.exchangesService.syncFromBinance({
        limit,
        tradeType,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[CRON] Sync completed in ${duration}ms - ` +
        `Fetched: ${result.exchangesFetched}, ` +
        `Created: ${result.exchangesCreated}, ` +
        `Skipped: ${result.exchangesSkipped}, ` +
        `Transactions: ${result.transactionsCreated}, ` +
        `Errors: ${result.errors.length}`
      );

      // Log errores individuales si existen
      if (result.errors.length > 0) {
        this.logger.warn(`[CRON] Sync completed with ${result.errors.length} errors:`);
        result.errors.forEach((error, index) => {
          this.logger.warn(`  Error ${index + 1}: ${error}`);
        });
      }

      // Alerta si no se obtuvieron exchanges (posible problema de API)
      if (result.exchangesFetched === 0) {
        this.logger.warn('[CRON] No exchanges fetched - check Binance API connection');
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
