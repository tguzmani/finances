import { Injectable } from '@nestjs/common';
import { RatesWithDiscounts } from '../../exchanges/exchange-rates-aggregator.service';

@Injectable()
export class TelegramRatesPresenter {
  /**
   * Format rates and discounts for Telegram display
   */
  formatRatesWithDiscounts(data: RatesWithDiscounts): string {
    const { rates, discounts } = data;

    let message = '<b>📊 Exchange Rates</b>\n\n';

    // Rates section
    message += '<b>Rates:</b>\n';
    message += this.formatRate('💵 BCV USD', rates.bcvUsd, 'Bs/USD');
    message += this.formatRate('💶 BCV EUR', rates.bcvEur, 'Bs/EUR');
    message += this.formatRate('🟢 Binance VES/USDT', rates.binanceVesUsdt, 'Bs/USDT');
    message += this.formatRate('📈 Internal Rate', rates.internalRate, 'Bs/USD');

    // Discounts section - organized by source
    message += '\n<b>Discounts:</b>\n';

    // Internal Rate discounts
    message += '<b>Internal Rate:</b>\n';
    message += this.formatDiscount('  🔹 BCV USD vs Internal', discounts.bcvUsdVsInternal);
    message += this.formatDiscount('  🔹 BCV EUR vs Internal', discounts.bcvEurVsInternal);

    // Binance discounts
    message += '\n<b>Binance:</b>\n';
    message += this.formatDiscount('  🔹 BCV USD vs Binance', discounts.bcvUsdVsBinance);
    message += this.formatDiscount('  🔹 BCV EUR vs Binance', discounts.bcvEurVsBinance);

    // Timestamp
    const timestamp = rates.timestamp.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    message += `\n<i>Updated: ${timestamp}</i>`;

    return message;
  }

  private formatRate(label: string, value: number | null, unit: string): string {
    if (value === null) {
      return `${label}: <i>Not available</i>\n`;
    }
    return `${label}: <b>${value.toFixed(2)}</b> ${unit}\n`;
  }

  private formatDiscount(label: string, value: number | null): string {
    if (value === null) {
      return `${label}: <i>Not available</i>\n`;
    }
    return `${label}: <b>${value.toFixed(2)}%</b>\n`;
  }
}
