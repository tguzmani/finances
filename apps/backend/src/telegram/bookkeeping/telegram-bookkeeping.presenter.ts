import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { ClosingWithBalances } from '../../bookkeeping/bookkeeping.service';

const ACCOUNT_LABELS: Record<string, string> = {
  BANESCO: '🏦 Banesco',
  BINANCE: '💱 Binance',
  WALLET: '👛 Wallet',
  CASH_BOX: '💵 Cash box',
  BOFA_CREDIT_CARD: '💳 BofA card',
};

@Injectable()
export class TelegramBookkeepingPresenter {
  /** The balances a closing just saved, as estimated, flagging what is still pending. */
  formatClosing(closing: ClosingWithBalances): string {
    const lines = closing.balances.map((balance) => {
      const amount = Number(balance.estimatedBalance).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const pending = balance.pendingTxCount + balance.pendingExchangeCount;
      const pendingText = pending > 0 ? ` · <i>${pending} pending</i>` : '';
      const label = ACCOUNT_LABELS[balance.account] ?? balance.account;
      return `${label}: ${amount} ${balance.currency}${pendingText}`;
    });

    return `📒 <b>Closing saved</b>\n\n${lines.join('\n')}\n\nHow did it go?`;
  }

  outcomeKeyboard(closingId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[
        { text: 'All good', callback_data: `cl_out:${closingId}:ALL_GOOD` },
        { text: 'Some issues', callback_data: `cl_out:${closingId}:SOME_ISSUES` },
        { text: 'Bad', callback_data: `cl_out:${closingId}:BAD` },
      ]],
    };
  }

  skipNoteKeyboard(closingId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[{ text: '⏭ Skip', callback_data: `cl_skip:${closingId}` }]],
    };
  }
}
