import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ExchangeRateSource } from '@prisma/client';
import { ExchangeRateService } from './exchange-rate.service';

export interface RatesSnapshot {
  bcvUsd: number | null;
  bcvEur: number | null;
  binanceVesUsdt: number | null;
  internalRate: number | null;
  timestamp: Date;
}

export interface RateDiscounts {
  bcvUsdVsInternal: number | null;
  bcvEurVsInternal: number | null;
  bcvUsdVsBinance: number | null;
  bcvEurVsBinance: number | null;
}

export interface RatesWithDiscounts {
  rates: RatesSnapshot;
  discounts: RateDiscounts;
}

@Injectable()
export class ExchangeRatesAggregatorService {
  private readonly logger = new Logger(ExchangeRatesAggregatorService.name);
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private cachedSnapshot: RatesSnapshot | null = null;
  private cachedAt: number | null = null;

  constructor(
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Get a snapshot of all exchange rates, cached in memory.
   * Returns cached version if still fresh, otherwise fetches from database.
   */
  async getRatesSnapshot(): Promise<RatesSnapshot> {
    if (this.cachedSnapshot && this.cachedAt && (Date.now() - this.cachedAt) < this.CACHE_TTL_MS) {
      this.logger.log('Returning cached rates snapshot');
      return this.cachedSnapshot;
    }

    this.logger.log('Fetching rates snapshot from database...');

    const [bcvUsdEntity, bcvEurEntity, binanceEntity, internalEntity] = await Promise.all([
      this.exchangeRateService.findLatest(ExchangeRateSource.BCV),
      this.exchangeRateService.findLatest(ExchangeRateSource.BCV_EUR),
      this.exchangeRateService.findLatest(ExchangeRateSource.BINANCE_P2P),
      this.exchangeRateService.findLatest(ExchangeRateSource.INTERNAL),
    ]);

    const bcvUsd = bcvUsdEntity ? Number(bcvUsdEntity.value) : null;
    const bcvEur = bcvEurEntity ? Number(bcvEurEntity.value) : null;
    const binanceVesUsdt = binanceEntity ? Number(binanceEntity.value) : null;
    const internalRate = internalEntity ? Number(internalEntity.value) : null;

    this.logger.log(
      `Rates snapshot: BCV USD=${bcvUsd}, BCV EUR=${bcvEur}, Binance VES/USDT=${binanceVesUsdt}, Internal=${internalRate}`
    );

    this.cachedSnapshot = {
      bcvUsd,
      bcvEur,
      binanceVesUsdt,
      internalRate,
      timestamp: new Date(),
    };
    this.cachedAt = Date.now();

    return this.cachedSnapshot;
  }

  @OnEvent('exchange-rate.created')
  invalidateCache(): void {
    this.cachedSnapshot = null;
    this.cachedAt = null;
    this.logger.log('Rates snapshot cache invalidated');
  }

  /**
   * Calculate discounts between rates using formula: (1 - (bcvRate / compareRate)) * 100
   * Positive = compareRate is higher than BCV (better rate, savings)
   * Negative = compareRate is lower than BCV (worse rate, surcharge)
   */
  calculateDiscounts(rates: RatesSnapshot): RateDiscounts {
    const calculateDiscount = (bcvRate: number | null, compareRate: number | null): number | null => {
      if (bcvRate === null || compareRate === null || compareRate === 0) {
        return null;
      }
      return (1 - bcvRate / compareRate) * 100;
    };

    return {
      bcvUsdVsInternal: calculateDiscount(rates.bcvUsd, rates.internalRate),
      bcvEurVsInternal: calculateDiscount(rates.bcvEur, rates.internalRate),
      bcvUsdVsBinance: calculateDiscount(rates.bcvUsd, rates.binanceVesUsdt),
      bcvEurVsBinance: calculateDiscount(rates.bcvEur, rates.binanceVesUsdt),
    };
  }

  /**
   * Get rates snapshot with calculated discounts
   */
  async getRatesWithDiscounts(): Promise<RatesWithDiscounts> {
    const rates = await this.getRatesSnapshot();
    const discounts = this.calculateDiscounts(rates);

    return {
      rates,
      discounts,
    };
  }
}
