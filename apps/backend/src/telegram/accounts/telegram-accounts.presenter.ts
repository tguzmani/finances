import { Injectable } from '@nestjs/common';
import { StablecoinOverview } from '../../accounts/interfaces/binance-account.interface';
import { BanescoStatus } from '../../accounts/accounts-banesco.service';
import { CashAccountStatus } from '../../accounts/accounts-cash.service';

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

  formatAllBalances(
    banesco: BanescoStatus,
    stablecoin: { overview: StablecoinOverview; sheetsBalance: number },
    wallet: CashAccountStatus,
    cashBox: CashAccountStatus,
    bofaCreditCard: CashAccountStatus,
    exchangeRate: number | null,
  ): string {
    let message = '<b>💰 All Balances</b>\n\n';

    // Banesco
    message += '<b>🏦 Banesco</b>\n';
    message += `Sheets: <b>${banesco.sheetsBalance.toFixed(2)} VES</b>`;
    if (exchangeRate) {
      message += ` (~${(banesco.sheetsBalance / exchangeRate).toFixed(2)} USD)`;
    }
    message += '\n';
    message += `Estimated: <b>${banesco.estimatedBalance.toFixed(2)} VES</b>`;
    if (exchangeRate) {
      message += ` (~${(banesco.estimatedBalance / exchangeRate).toFixed(2)} USD)`;
    }
    message += '\n';
    message += `<i>${banesco.pendingTxCount} pending tx, ${banesco.pendingExchangeCount} pending exchanges</i>\n\n`;

    // Binance Stablecoin
    message += '<b>💱 Binance Stablecoin</b>\n';
    for (const asset of stablecoin.overview.assets) {
      const { funding, earn } = asset.breakdown;
      message += `<b>${asset.asset}:</b> ${asset.totalBalance.toFixed(2)}\n`;
      if (funding > 0 || earn > 0) {
        message += `  Funding: ${funding.toFixed(2)} | Earn: ${earn.toFixed(2)}\n`;
      }
    }
    const binanceTotal = stablecoin.overview.totalBalance;
    message += `<b>Binance Total:</b> ${binanceTotal.toFixed(2)} USD\n`;
    message += `<b>Internal Balance:</b> ${stablecoin.sheetsBalance.toFixed(2)} USD\n`;
    const diff = Math.abs(binanceTotal - stablecoin.sheetsBalance);
    const inFavourOf = binanceTotal > stablecoin.sheetsBalance ? 'Binance' : 'Internal';
    message += `<b>Difference:</b> ${diff.toFixed(2)} USD in favour of ${inFavourOf}\n\n`;

    // Wallet
    message += '<b>👛 Wallet</b>\n';
    message += `Sheets: <b>${wallet.sheetsBalance.toFixed(2)} USD</b>\n`;
    message += `Estimated: <b>${wallet.estimatedBalance.toFixed(2)} USD</b>\n`;
    message += `<i>${wallet.pendingTxCount} pending tx</i>\n\n`;

    // CashBox
    message += '<b>💵 CashBox</b>\n';
    message += `Sheets: <b>${cashBox.sheetsBalance.toFixed(2)} USD</b>\n`;
    message += `Estimated: <b>${cashBox.estimatedBalance.toFixed(2)} USD</b>\n`;
    message += `<i>${cashBox.pendingTxCount} pending tx</i>\n\n`;

    // BofA Credit Card
    message += '<b>💳 BofA Credit Card</b>\n';
    message += `Sheets: <b>${bofaCreditCard.sheetsBalance.toFixed(2)} USD</b>\n`;
    message += `Estimated: <b>${bofaCreditCard.estimatedBalance.toFixed(2)} USD</b>\n`;
    message += `<i>${bofaCreditCard.pendingTxCount} pending tx</i>`;

    return message;
  }

  formatBalanceAdjustment(result: {
    previousBalance: number;
    newBalance: number;
    difference: number;
    differenceInUsd: number;
  }): string {
    return (
      `Banesco balance adjusted successfully!\n\n` +
      `Previous: ${result.previousBalance.toFixed(2)} Bs\n` +
      `New: ${result.newBalance.toFixed(2)} Bs\n` +
      `Difference: ${result.difference.toFixed(2)} Bs (${result.differenceInUsd.toFixed(2)} USD)`
    );
  }
}
