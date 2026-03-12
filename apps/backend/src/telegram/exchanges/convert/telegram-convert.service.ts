import { Injectable, Logger } from '@nestjs/common';
import { ExchangeRatesAggregatorService, RatesSnapshot } from '../../../exchanges/exchange-rates-aggregator.service';
import { BanescoAccountService } from '../../../accounts/accounts-banesco.service';
import { TelegramConvertPresenter } from './telegram-convert.presenter';

type Currency = 'VES' | 'USD' | 'EUR';

export interface ConvertResponse {
  message: string;
  bcvAmount?: number | null;
  internalAmount?: number | null;
}

export interface ConversionResult {
  inputAmount: number;
  inputCurrency: Currency;
  outputAmount: number;
  outputCurrency: string;
  rateUsed: number;
  rateName: string;
  vesAmount: number | null;
  vesAmountInternal: number | null;
  rates: RatesSnapshot;
  banescoAvailability?: {
    available: boolean;
    differenceVes: number;
    differenceUsd: number;
  };
}

@Injectable()
export class TelegramConvertService {
  private readonly logger = new Logger(TelegramConvertService.name);

  constructor(
    private readonly ratesAggregator: ExchangeRatesAggregatorService,
    private readonly banescoService: BanescoAccountService,
    private readonly presenter: TelegramConvertPresenter,
  ) {}

  async handleConvert(input: string): Promise<ConvertResponse> {
    const parsed = this.parseInput(input);

    if (!parsed) {
      return { message: this.presenter.formatUsage() };
    }

    const { amount, currency } = parsed;
    const rates = await this.ratesAggregator.getRatesSnapshot();

    const result = this.convert(amount, currency, rates);

    if (!result) {
      return { message: this.presenter.formatMissingRate(currency) };
    }

    // Check Banesco availability
    try {
      const vesNeeded = result.vesAmount ?? result.inputAmount;
      const banescoStatus = await this.banescoService.getBanescoStatus();
      const difference = banescoStatus.estimatedBalance - vesNeeded;

      if (difference >= 0) {
        // Available — use internal rate for the remaining difference
        const diffUsd = rates.internalRate ? difference / rates.internalRate : 0;
        result.banescoAvailability = {
          available: true,
          differenceVes: difference,
          differenceUsd: diffUsd,
        };
      } else {
        // Not available — use binance rate for the shortfall
        const shortfall = Math.abs(difference);
        const diffUsd = rates.binanceVesUsdt ? shortfall / rates.binanceVesUsdt : 0;
        result.banescoAvailability = {
          available: false,
          differenceVes: shortfall,
          differenceUsd: diffUsd,
        };
      }
    } catch (error) {
      this.logger.warn(`Could not check Banesco availability: ${error.message}`);
    }

    return {
      message: this.presenter.formatConversion(result),
      bcvAmount: result.vesAmount,
      internalAmount: result.vesAmountInternal,
    };
  }

  private parseInput(input: string): { amount: number; currency: Currency } | null {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);

    if (parts.length !== 2) {
      return null;
    }

    const amount = parseFloat(parts[0]);
    if (isNaN(amount) || amount <= 0) {
      return null;
    }

    const currency = parts[1].toUpperCase();
    if (!['VES', 'USD', 'EUR'].includes(currency)) {
      return null;
    }

    return { amount, currency: currency as Currency };
  }

  private convert(amount: number, currency: Currency, rates: RatesSnapshot): ConversionResult | null {
    const { internalRate, bcvUsd, bcvEur } = rates;

    if (!internalRate) {
      return null;
    }

    switch (currency) {
      case 'VES': {
        const outputAmount = amount / internalRate;
        return {
          inputAmount: amount,
          inputCurrency: currency,
          outputAmount,
          outputCurrency: 'USD',
          rateUsed: internalRate,
          rateName: 'Internal',
          vesAmount: null,
          vesAmountInternal: null,
          rates,
        };
      }

      case 'USD': {
        if (!bcvUsd) return null;
        const outputAmount = (amount * bcvUsd) / internalRate;
        const vesAmount = amount * bcvUsd;
        const vesAmountInternal = amount * internalRate;
        return {
          inputAmount: amount,
          inputCurrency: currency,
          outputAmount,
          outputCurrency: 'USD',
          rateUsed: bcvUsd,
          rateName: 'BCV USD',
          vesAmount,
          vesAmountInternal,
          rates,
        };
      }

      case 'EUR': {
        if (!bcvEur) return null;
        const outputAmount = (amount * bcvEur) / internalRate;
        const vesAmount = amount * bcvEur;
        return {
          inputAmount: amount,
          inputCurrency: currency,
          outputAmount,
          outputCurrency: 'USD',
          rateUsed: bcvEur,
          rateName: 'BCV EUR',
          vesAmount,
          vesAmountInternal: null,
          rates,
        };
      }
    }
  }
}
