import { Injectable } from '@nestjs/common';
import { StablecoinOverview } from '../../accounts/interfaces/binance-account.interface';

@Injectable()
export class TelegramAccountsPresenter {
  formatStablecoinOverview(overview: StablecoinOverview): string {
    let message = '<b>Binance Stablecoin Balance</b>\n\n';

    for (const asset of overview.assets) {
      const { funding, earn } = asset.breakdown;
      message += `<b>${asset.asset}:</b> ${asset.totalBalance.toFixed(2)}\n`;
      if (funding > 0 || earn > 0) {
        message += `  Funding: ${funding.toFixed(2)} | Earn: ${earn.toFixed(2)}\n`;
      }
    }

    message += `\n<b>Total:</b> ${overview.totalBalance.toFixed(2)} USD`;

    return message;
  }
}
