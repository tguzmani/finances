import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/types';
import {
  methodLabel,
  platformLabel,
  typeIcon,
  typeLabel,
} from '../../transactions/transaction-labels';
import { RecalledDraft } from './recall-extraction.service';

@Injectable()
export class TelegramRecallPresenter {
  /**
   * One recalled entry, up for confirmation. An amount the user hedged is shown
   * with "≈" so a figure that still has to be checked never looks like a number
   * read off a receipt.
   */
  card(
    draft: RecalledDraft,
    index: number,
    total: number,
    internalRate?: number,
  ): { text: string; keyboard: InlineKeyboardMarkup } {
    const amount = draft.amount ?? 0;
    const currency = draft.currency ?? '';
    const marker = draft.approximate ? '≈ ' : '';
    const usd =
      currency === 'VES' && internalRate ? ` (USD ${(amount / internalRate).toFixed(2)})` : '';

    const lines = [
      `🧠 <b>Recalled entry ${index + 1}/${total}</b>`,
      '',
      `Type: ${typeIcon(draft.type ?? 'EXPENSE')} ${typeLabel(draft.type ?? 'EXPENSE')}`,
      `Account: ${platformLabel(draft.platform ?? '')} (${currency})`,
      `Amount: ${marker}${currency} ${amount.toFixed(2)}${usd}`,
      `Description: ${this.escape(draft.description ?? '')}`,
    ];

    if (draft.method) lines.push(`Method: ${methodLabel(draft.method)}`);
    lines.push(`Date: ${this.date(draft.date)}`);

    if (draft.approximate) {
      lines.push('', '<i>Amount from memory — tap Amount to correct it.</i>');
    }

    return {
      text: lines.join('\n'),
      keyboard: Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Save', `recall_save:${index}`),
          Markup.button.callback('✏️ Amount', `recall_amount:${index}`),
          Markup.button.callback('⏭ Skip', `recall_skip:${index}`),
        ],
        [Markup.button.callback('🚫 Cancel', `recall_cancel:${index}`)],
      ]).reply_markup,
    };
  }

  /** What the batch came to, once every entry has been decided. */
  summary(saved: number, skipped: number): string {
    if (saved === 0) {
      return '🧠 <b>Nothing saved</b>\n\nEvery recalled entry was skipped.';
    }

    const skippedLine = skipped > 0 ? `\n${skipped} skipped.` : '';
    return (
      `🧠 <b>${saved} recalled ${saved === 1 ? 'entry' : 'entries'} saved</b>${skippedLine}\n\n` +
      `<i>Estimated amounts are marked as such and can be refined later.</i>`
    );
  }

  /** Entries the model read but could not pin to an amount and an account. */
  unusable(count: number): string {
    return (
      `⚠️ ${count} ${count === 1 ? 'entry was' : 'entries were'} left out: ` +
      `no amount or no account could be read. Send those one by one.`
    );
  }

  notATransaction(): string {
    return '🤷 No transaction found in that. Try naming what you spent and how much.';
  }

  private date(iso: string | null): string {
    const value = iso ? new Date(iso) : new Date();
    const resolved = isNaN(value.getTime()) ? new Date() : value;

    return resolved.toLocaleString('en-US', {
      timeZone: 'America/Caracas',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
