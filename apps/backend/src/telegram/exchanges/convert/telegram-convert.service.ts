import { Injectable, Logger } from '@nestjs/common';
import { ExchangeRatesAggregatorService, RatesSnapshot } from '../../../exchanges/exchange-rates-aggregator.service';
import { TelegramConvertPresenter } from './telegram-convert.presenter';

type Currency = 'VES' | 'USD' | 'EUR';

interface ConversionResult {
  inputAmount: number;
  inputCurrency: Currency;
  outputAmount: number;
  outputCurrency: string;
  rateUsed: number;
  rateName: string;
  rates: RatesSnapshot;
}

@Injectable()
export class TelegramConvertService {
  private readonly logger = new Logger(TelegramConvertService.name);

  constructor(
    private readonly ratesAggregator: ExchangeRatesAggregatorService,
    private readonly presenter: TelegramConvertPresenter,
  ) {}

  async handleConvert(input: string): Promise<string> {
    const parsed = this.parseInput(input);

    if (!parsed) {
      return this.presenter.formatUsage();
    }

    const { amount, currency } = parsed;
    const rates = await this.ratesAggregator.getRatesSnapshot();

    const result = this.convert(amount, currency, rates);

    if (!result) {
      return this.presenter.formatMissingRate(currency);
    }

    return this.presenter.formatConversion(result);
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
          rates,
        };
      }

      case 'USD': {
        if (!bcvUsd) return null;
        const outputAmount = (amount * bcvUsd) / internalRate;
        return {
          inputAmount: amount,
          inputCurrency: currency,
          outputAmount,
          outputCurrency: 'USD',
          rateUsed: bcvUsd,
          rateName: 'BCV USD',
          rates,
        };
      }

      case 'EUR': {
        if (!bcvEur) return null;
        const outputAmount = (amount * bcvEur) / internalRate;
        return {
          inputAmount: amount,
          inputCurrency: currency,
          outputAmount,
          outputCurrency: 'USD',
          rateUsed: bcvEur,
          rateName: 'BCV EUR',
          rates,
        };
      }
    }
  }
}
