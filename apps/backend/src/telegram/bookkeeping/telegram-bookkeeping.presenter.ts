import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { ClosingWithBalances, OpenedCheckIn } from '../../bookkeeping/bookkeeping.service';
import { TelegramAccountsPresenter } from '../accounts/telegram-accounts.presenter';

const ACCOUNT_LABELS: Record<string, string> = {
  BANESCO: '🏦 Banesco',
  BINANCE: '💱 Binance',
  WALLET: '👛 Wallet',
  CASH_BOX: '💵 Cash box',
  BOFA_CREDIT_CARD: '💳 BofA card',
};

@Injectable()
export class TelegramBookkeepingPresenter {
  constructor(private readonly accountsPresenter: TelegramAccountsPresenter) {}

  formatCheckIn({ banesco, lastClosing }: OpenedCheckIn): string {
    const lastClosingText = lastClosing
      ? this.formatDateTime(lastClosing.closedAt)
      : 'never';

    return (
      '🌙 <b>Daily check-in</b>\n\n' +
      this.accountsPresenter.formatBanescoBalance(banesco) + '\n\n' +
      `📒 Last closing: ${lastClosingText}\n\n` +
      'Are all your expenses registered? Is Banesco up to date?'
    );
  }

  checkInKeyboard(checkInId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[
        { text: 'Yes', callback_data: `ci_ans:${checkInId}:yes` },
        { text: 'No', callback_data: `ci_ans:${checkInId}:no` },
      ]],
    };
  }

  initiativeKeyboard(checkInId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[
        { text: 'On my own', callback_data: `ci_ini:${checkInId}:OWN` },
        { text: 'The reminder', callback_data: `ci_ini:${checkInId}:REMINDER` },
      ]],
    };
  }

  missReasonKeyboard(checkInId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: 'Forgot about it', callback_data: `ci_miss:${checkInId}:FORGOT` }],
        [{ text: 'Complex transaction', callback_data: `ci_miss:${checkInId}:COMPLEX_TRANSACTION` }],
        [{ text: 'Other', callback_data: `ci_miss:${checkInId}:OTHER` }],
      ],
    };
  }

  closeNowKeyboard(checkInId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[{ text: '📒 Close now', callback_data: `ci_close:${checkInId}` }]],
    };
  }

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

  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      timeZone: 'America/Caracas',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
