import { Injectable } from '@nestjs/common';
import { ConversionResult } from './telegram-convert.service';

@Injectable()
export class TelegramConvertPresenter {
  formatConversion(result: ConversionResult): string {
    const { inputAmount, inputCurrency, lines } = result;

    let message = '<b>💱 Conversion</b>\n';
    message += `<i>Read as ${this.formatNumber(inputAmount)} ${inputCurrency}</i>\n\n`;

    for (const line of lines) {
      message += `${line.label}: <b>${this.formatNumber(line.amount)}</b>`;
      message += ` <i>@ ${this.formatNumber(line.rate)}</i>\n`;
    }

    return message.trimEnd();
  }

  formatBanescoAvailability(availability: { available: boolean; differenceVes: number; differenceUsd: number }): string {
    if (availability.available) {
      return `\n✅ Available. ${this.formatNumber(availability.differenceVes)} VES (${this.formatNumber(availability.differenceUsd)} USD) will remain in account`;
    }
    return `\n❌ Not available. ${this.formatNumber(availability.differenceVes)} VES (${this.formatNumber(availability.differenceUsd)} USD) is required`;
  }

  formatUsage(): string {
    return (
      'Could not read an amount and a currency from that.\n\n' +
      'Supported currencies: VES, USD, EUR\n' +
      '<i>Write it however you like: 100 USD, $18,68, 27.837,82 bs, 50 euros</i>'
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
