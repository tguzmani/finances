import { Injectable } from '@nestjs/common';
import { BinanceStablecoinStatus, StablecoinOverview } from '../../accounts/interfaces/binance-account.interface';
import { BanescoBalanceSnapshot, BanescoStatus } from '../../accounts/accounts-banesco.service';
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

  /**
   * The "how much is left in Banesco" message, shown after every movement that
   * touches the account.
   *
   * The headline is what is actually left in the bank: the ledger balance minus
   * every Banesco movement that has not been registered yet. The ledger figure
   * follows only when the two differ, so the gap is visible.
   */
  formatBanescoBalance(snapshot: BanescoBalanceSnapshot, reason?: string): string {
    const money = (ves: number, usd: number | null): string => {
      const vesText = ves.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const usdText = usd === null ? '' : ` (${usd.toFixed(2)} USD)`;
      return `${vesText} VES${usdText}`;
    };

    // What the unregistered movements take out of the sheet balance. Exchanges
    // bring bolivares in, so this flips positive when they outweigh the
    // transactions going out, and the sign has to follow.
    const pendingVes = snapshot.ves - snapshot.estimatedVes;
    const pendingSign = pendingVes < 0 ? '+' : '−';
    const pendingCount = snapshot.pendingTxCount + snapshot.pendingExchangeCount;

    let message = '🏦 <b>Banesco balance</b>\n';
    if (reason) {
      message += `<i>after ${reason}</i>\n`;
    }

    message += `\n<b>${money(snapshot.estimatedVes, snapshot.estimatedUsd)}</b>\n`;

    if (pendingCount > 0) {
      message += `\nSheet: ${money(snapshot.ves, snapshot.usd)}\n`;
      const pendingAbs = Math.abs(pendingVes);
      message += `Pending: ${pendingSign}${money(pendingAbs, snapshot.rate ? pendingAbs / snapshot.rate : null)}\n`;
      message += `<i>${snapshot.pendingTxCount} tx, ${snapshot.pendingExchangeCount} exchanges not registered yet</i>\n`;
    }

    if (snapshot.rate !== null) {
      message += `\n<i>Rate: ${snapshot.rate.toFixed(2)} VES/USD</i>`;
    }

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
    binanceStatus: BinanceStablecoinStatus,
    wallet: CashAccountStatus,
    cashBox: CashAccountStatus,
    bofaCreditCard: CashAccountStatus,
    exchangeRate: number | null,
    bcvRates?: { bcvUsd: number | null; bcvEur: number | null },
  ): string {
    let message = '<b>💰 All Balances</b>\n\n';

    // Banesco
    message += '<b>🏦 Banesco</b>\n';
    message += `Sheets: <b>${banesco.sheetsBalance.toFixed(2)} VES</b>`;
    if (exchangeRate) {
      message += ` (${(banesco.sheetsBalance / exchangeRate).toFixed(2)} USD)`;
    }
    message += '\n';
    message += `Estimated: <b>${banesco.estimatedBalance.toFixed(2)} VES</b>`;
    if (exchangeRate) {
      message += ` (${(banesco.estimatedBalance / exchangeRate).toFixed(2)} USD)`;
    }
    message += '\n';
    if (bcvRates?.bcvUsd) {
      message += `BCV USD: ${(banesco.estimatedBalance / bcvRates.bcvUsd).toFixed(2)} USD\n`;
    }
    if (bcvRates?.bcvEur) {
      message += `BCV EUR: ${(banesco.estimatedBalance / bcvRates.bcvEur).toFixed(2)} EUR\n`;
    }
    message += `<i>${banesco.pendingTxCount} pending tx, ${banesco.pendingExchangeCount} pending exchanges</i>\n\n`;

    // Binance Stablecoin
    message += '<b>💱 Binance Stablecoin</b>\n';
    for (const asset of binanceStatus.overview.assets) {
      const { funding, earn } = asset.breakdown;
      message += `<b>${asset.asset}:</b> ${asset.totalBalance.toFixed(2)}\n`;
      if (funding > 0 || earn > 0) {
        message += `  Funding: ${funding.toFixed(2)} | Earn: ${earn.toFixed(2)}\n`;
      }
    }
    const binanceTotal = binanceStatus.overview.totalBalance;
    message += `<b>Binance Total:</b> ${binanceTotal.toFixed(2)} USD\n`;
    message += `Sheets: <b>${binanceStatus.sheetsBalance.toFixed(2)} USD</b>\n`;
    message += `Estimated: <b>${binanceStatus.estimatedBalance.toFixed(2)} USD</b>\n`;
    const diff = Math.abs(binanceTotal - binanceStatus.estimatedBalance);
    const inFavourOf = binanceTotal > binanceStatus.estimatedBalance ? 'Binance' : 'Internal';
    message += `<b>Difference:</b> ${diff.toFixed(2)} USD in favour of ${inFavourOf}\n`;
    message += `<i>${binanceStatus.pendingExchangeCount} pending exchanges</i>\n\n`;

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
