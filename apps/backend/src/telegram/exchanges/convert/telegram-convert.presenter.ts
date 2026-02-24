import { Injectable } from '@nestjs/common';

interface ConversionResult {
  inputAmount: number;
  inputCurrency: string;
  outputAmount: number;
  outputCurrency: string;
  rateUsed: number;
  rateName: string;
  vesAmount: number | null;
  rates: {
    internalRate: number | null;
    bcvUsd: number | null;
    bcvEur: number | null;
  };
}

@Injectable()
export class TelegramConvertPresenter {
  formatConversion(result: ConversionResult): string {
    const { inputAmount, inputCurrency, outputAmount, outputCurrency, rateUsed, rateName, vesAmount, rates } = result;

    let message = '<b>💱 Conversion</b>\n\n';
    message += `${this.formatNumber(inputAmount)} ${inputCurrency} = <b>${this.formatNumber(outputAmount)} ${outputCurrency}</b>\n`;
    if (vesAmount !== null) {
      message += `${this.formatNumber(inputAmount)} ${inputCurrency} = <b>${this.formatNumber(vesAmount)} VES</b>\n`;
    }
    message += `\n<i>Rate used: ${rateName} @ ${this.formatNumber(rateUsed)}</i>\n`;
    message += `<i>Internal rate: ${rates.internalRate ? this.formatNumber(rates.internalRate) : 'N/A'}</i>`;

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
