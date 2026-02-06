import { Injectable, Logger } from '@nestjs/common';
import { ExchangesBcvService } from './exchanges-bcv.service';
import { ExchangesBinanceService } from './exchanges-binance.service';
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

  constructor(
    private readonly bcvService: ExchangesBcvService,
    private readonly binanceService: ExchangesBinanceService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Get a snapshot of all exchange rates in parallel
   */
  async getRatesSnapshot(): Promise<RatesSnapshot> {
    this.logger.log('Fetching rates snapshot from all sources...');

    // When selling USDT for VES, you need advertisers who are BUYING USDT (they give you VES)
    // So tradeType should be 'BUY' not 'SELL'
    // Note: Not using transAmount filter for now as it may refer to fiat amount, not asset amount
    const results = await Promise.allSettled([
      this.bcvService.getUsdExchangeRate(),
      this.bcvService.getEurExchangeRate(),
      this.binanceService.getAverageP2PRate('VES', 'USDT', 'BUY', 10),
      this.exchangeRateService.findLatest(),
    ]);

    const bcvUsd = results[0].status === 'fulfilled' ? results[0].value : null;
    const bcvEur = results[1].status === 'fulfilled' ? results[1].value : null;
    const binanceVesUsdt = results[2].status === 'fulfilled' ? results[2].value : null;
    const internalRateEntity = results[3].status === 'fulfilled' ? results[3].value : null;
    const internalRate = internalRateEntity ? Number(internalRateEntity.value) : null;

    this.logger.log(
      `Rates snapshot: BCV USD=${bcvUsd}, BCV EUR=${bcvEur}, Binance VES/USDT=${binanceVesUsdt}, Internal=${internalRate}`
    );

    return {
      bcvUsd,
      bcvEur,
      binanceVesUsdt,
      internalRate,
      timestamp: new Date(),
    };
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
