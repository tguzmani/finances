import { Injectable } from '@nestjs/common';
import { ConversionResult } from './telegram-convert.service';

@Injectable()
export class TelegramConvertPresenter {
  formatConversion(result: ConversionResult): string {
    const { inputAmount, inputCurrency, outputAmount, outputCurrency, rateUsed, rateName, vesAmount, vesAmountInternal, rates } = result;

    const rateLabel = inputCurrency === 'VES' ? '' : ' BCV';
    const outLabel = inputCurrency === 'VES' ? '' : ' Internal';

    let message = '<b>💱 Conversion</b>\n\n';
    message += `${this.formatNumber(inputAmount)} ${inputCurrency}${rateLabel} = <b>${this.formatNumber(outputAmount)} ${outputCurrency}${outLabel}</b>\n`;
    if (vesAmount !== null) {
      message += `${this.formatNumber(inputAmount)} ${inputCurrency}${rateLabel} = <b>${this.formatNumber(vesAmount)} VES</b>\n`;
    }
    if (vesAmountInternal !== null) {
      message += `${this.formatNumber(inputAmount)} ${inputCurrency} Internal = <b>${this.formatNumber(vesAmountInternal)} VES</b>\n`;
    }

    message += `\n<i>Rate used: ${rateName} @ ${this.formatNumber(rateUsed)}</i>\n`;
    message += `<i>Internal rate: ${rates.internalRate ? this.formatNumber(rates.internalRate) : 'N/A'}</i>`;

    return message;
  }

  formatBanescoAvailability(availability: { available: boolean; differenceVes: number; differenceUsd: number }): string {
    if (availability.available) {
      return `\n✅ Available. ${this.formatNumber(availability.differenceVes)} VES (${this.formatNumber(availability.differenceUsd)} USD) will remain in account`;
    }
    return `\n❌ Not available. ${this.formatNumber(availability.differenceVes)} VES (${this.formatNumber(availability.differenceUsd)} USD) is required`;
  }

  formatUsage(): string {
    return (
      '<b>Usage:</b> /convert {amount} {currency}\n\n' +
      'Supported currencies: VES, USD, EUR\n' +
      'Example: <code>/convert 8177.49 VES</code>'
    );
  }

  formatMissingRate(currency: string): string {
    return `Could not fetch the required exchange rates for ${currency} conversion. Please try again later.`;
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
