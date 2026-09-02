import { Injectable, Logger } from '@nestjs/common';
import { ExchangeRatesAggregatorService, RatesSnapshot } from '../../../exchanges/exchange-rates-aggregator.service';
import { AmountExtractionService } from '../../../common/amount-extraction.service';
import { BanescoAccountService } from '../../../accounts/accounts-banesco.service';
import { TelegramConvertPresenter } from './telegram-convert.presenter';

type Currency = 'VES' | 'USD' | 'EUR';

export interface ConvertResponse {
  message: string;
  bcvAmount?: number | null;
  internalAmount?: number | null;
  rates?: RatesSnapshot;
}

/** One "X = Y" line of a conversion, with the rate that produced it. */
export interface ConversionLine {
  label: string;
  amount: number;
  rateName: string;
  rate: number;
}

export interface ConversionResult {
  inputAmount: number;
  inputCurrency: Currency;
  lines: ConversionLine[];
  /** VES at the BCV rate, for the copy button and the Banesco check. */
  vesAmount: number | null;
  /** VES at the internal rate, for the copy button. */
  vesAmountInternal: number | null;
  rates: RatesSnapshot;
}

@Injectable()
export class TelegramConvertService {
  private readonly logger = new Logger(TelegramConvertService.name);

  constructor(
    private readonly ratesAggregator: ExchangeRatesAggregatorService,
    private readonly banescoService: BanescoAccountService,
    private readonly amountExtraction: AmountExtractionService,
    private readonly presenter: TelegramConvertPresenter,
  ) {}

  async handleConvert(input: string): Promise<ConvertResponse> {
    const { amount, currency } = await this.amountExtraction.extract(input);

    if (amount === null || currency === null) {
      return { message: this.presenter.formatUsage() };
    }

    const rates = await this.ratesAggregator.getRatesSnapshot();

    const result = this.convert(amount, currency, rates);

    if (!result) {
      return { message: this.presenter.formatMissingRate(currency) };
    }

    return {
      message: this.presenter.formatConversion(result),
      bcvAmount: result.vesAmount,
      internalAmount: result.vesAmountInternal,
      rates,
    };
  }

  async checkBanesco(vesAmount: number, rates: RatesSnapshot): Promise<string> {
    const banescoStatus = await this.banescoService.getBanescoStatus();
    const difference = banescoStatus.estimatedBalance - vesAmount;

    if (difference >= 0) {
      const diffUsd = rates.internalRate ? difference / rates.internalRate : 0;
      return this.presenter.formatBanescoAvailability({ available: true, differenceVes: difference, differenceUsd: diffUsd });
    }

    const shortfall = Math.abs(difference);
    const diffUsd = rates.binanceVesUsdt ? shortfall / rates.binanceVesUsdt : 0;
    return this.presenter.formatBanescoAvailability({ available: false, differenceVes: shortfall, differenceUsd: diffUsd });
  }

  private convert(amount: number, currency: Currency, rates: RatesSnapshot): ConversionResult | null {
    const { internalRate, bcvUsd, bcvEur } = rates;

    if (!internalRate) {
      return null;
    }

    const lines: ConversionLine[] = [];

    switch (currency) {
      case 'VES': {
        // Bolivares are worth a different number of dollars under each rate, so
        // show all three rather than picking one.
        if (bcvUsd) {
          lines.push({ label: 'USD BCV', amount: amount / bcvUsd, rateName: 'BCV USD', rate: bcvUsd });
        }
        if (bcvEur) {
          lines.push({ label: 'EUR BCV', amount: amount / bcvEur, rateName: 'BCV EUR', rate: bcvEur });
        }
        lines.push({ label: 'USD Internal', amount: amount / internalRate, rateName: 'Internal', rate: internalRate });

        return { inputAmount: amount, inputCurrency: currency, lines, vesAmount: null, vesAmountInternal: null, rates };
      }

      case 'USD': {
        if (!bcvUsd) return null;

        const vesAmount = amount * bcvUsd;
        const vesAmountInternal = amount * internalRate;

        lines.push({ label: 'VES BCV', amount: vesAmount, rateName: 'BCV USD', rate: bcvUsd });
        lines.push({ label: 'VES Internal', amount: vesAmountInternal, rateName: 'Internal', rate: internalRate });
        lines.push({ label: 'USD Internal', amount: vesAmount / internalRate, rateName: 'Internal', rate: internalRate });

        return { inputAmount: amount, inputCurrency: currency, lines, vesAmount, vesAmountInternal, rates };
      }

      case 'EUR': {
        if (!bcvEur) return null;

        const vesAmount = amount * bcvEur;
        // The internal rate is the yardstick whatever the input currency is:
        // it answers "what would this cost me in bolivares", not "what is a
        // euro worth". So it applies to the amount directly, same as for USD.
        const vesAmountInternal = amount * internalRate;

        lines.push({ label: 'VES BCV', amount: vesAmount, rateName: 'BCV EUR', rate: bcvEur });
        lines.push({ label: 'VES Internal', amount: vesAmountInternal, rateName: 'Internal', rate: internalRate });
        lines.push({ label: 'USD Internal', amount: vesAmount / internalRate, rateName: 'Internal', rate: internalRate });

        return { inputAmount: amount, inputCurrency: currency, lines, vesAmount, vesAmountInternal, rates };
      }
    }
  }
}
