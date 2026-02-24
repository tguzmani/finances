import { Injectable } from '@nestjs/common';
import { ConversionResult } from './telegram-convert.service';

@Injectable()
export class TelegramConvertPresenter {
  formatConversion(result: ConversionResult): string {
    const { inputAmount, inputCurrency, outputAmount, outputCurrency, rateUsed, rateName, vesAmount, rates, banescoAvailability } = result;

    const rateLabel = inputCurrency === 'VES' ? '' : ` ${rateName.replace('BCV ', '')}`;
    const outLabel = inputCurrency === 'VES' ? '' : ' Internal';

    let message = '<b>💱 Conversion</b>\n\n';
    message += `${this.formatNumber(inputAmount)} ${inputCurrency}${rateLabel} = <b>${this.formatNumber(outputAmount)} ${outputCurrency}${outLabel}</b>\n`;
    if (vesAmount !== null) {
      message += `${this.formatNumber(inputAmount)} ${inputCurrency}${rateLabel} = <b>${this.formatNumber(vesAmount)} VES</b>\n`;
    }

    // Banesco availability between conversions and rates
    if (banescoAvailability) {
      message += '\n';
      if (banescoAvailability.available) {
        message += `✅ Available. ${this.formatNumber(banescoAvailability.differenceVes)} VES (${this.formatNumber(banescoAvailability.differenceUsd)} USD) will remain in account`;
      } else {
        message += `❌ Not available. ${this.formatNumber(banescoAvailability.differenceVes)} VES (${this.formatNumber(banescoAvailability.differenceUsd)} USD) is required`;
      }
      message += '\n';
    }

    message += `\n<i>Rate used: ${rateName} @ ${this.formatNumber(rateUsed)}</i>\n`;
    message += `<i>Internal rate: ${rates.internalRate ? this.formatNumber(rates.internalRate) : 'N/A'}</i>`;
    if (banescoAvailability && !banescoAvailability.available && rates.binanceVesUsdt) {
      message += `\n<i>Binance rate: ${this.formatNumber(rates.binanceVesUsdt)}</i>`;
    }

    return message;
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
