import { Injectable } from '@nestjs/common';
import { StablecoinOverview } from '../../accounts/interfaces/binance-account.interface';

@Injectable()
export class TelegramAccountsPresenter {
  formatBanescoStatus(
    sheetsBalance: number,
    estimatedBalance: number,
    pendingTxCount: number,
    pendingExchangeCount: number,
  ): string {
    let message = '<b>🏦 Banesco</b>\n\n';
    message += `Sheets Balance: <b>${sheetsBalance.toFixed(2)} VES</b>\n`;
    message += `Estimated Balance: <b>${estimatedBalance.toFixed(2)} VES</b>\n\n`;
    message += `<i>${pendingTxCount} pending transactions, ${pendingExchangeCount} pending exchanges</i>`;
    return message;
  }

  formatStablecoinOverview(overview: StablecoinOverview, sheetsBalance: number): string {
    let message = '<b>Binance Stablecoin Balance</b>\n\n';

    for (const asset of overview.assets) {
      const { funding, earn } = asset.breakdown;
      message += `<b>${asset.asset}:</b> ${asset.totalBalance.toFixed(2)}\n`;
      if (funding > 0 || earn > 0) {
        message += `  Funding: ${funding.toFixed(2)} | Earn: ${earn.toFixed(2)}\n`;
      }
    }

    const binanceTotal = overview.totalBalance;
    message += `\n<b>Binance Total:</b> ${binanceTotal.toFixed(2)} USD`;
    message += `\n<b>Internal Balance:</b> ${sheetsBalance.toFixed(2)} USD`;

    const difference = Math.abs(binanceTotal - sheetsBalance);
    const inFavourOf = binanceTotal > sheetsBalance ? 'Binance' : 'Internal';

    message += `\n<b>Difference:</b> ${difference.toFixed(2)} USD in favour of ${inFavourOf}`;

    return message;
  }
}
