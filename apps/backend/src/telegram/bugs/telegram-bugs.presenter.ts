import { Injectable } from '@nestjs/common';
import { BugReport, BugReportStatus } from '@prisma/client';
import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/types';

@Injectable()
export class TelegramBugsPresenter {
  /** The receipt for a filed report, with a way out if it was a mistake. */
  filed(bug: BugReport): { text: string; keyboard: InlineKeyboardMarkup } {
    return {
      text:
        `🐞 <b>Bug #${bug.id} filed</b>\n\n` +
        `${this.escape(bug.text)}\n\n` +
        `<i>It will be announced here once it is fixed.</i>`,
      keyboard: Markup.inlineKeyboard([
        Markup.button.callback('🗑 Discard', `bug_discard:${bug.id}`),
      ]).reply_markup,
    };
  }

  openList(bugs: BugReport[]): string {
    if (bugs.length === 0) {
      return '🐞 <b>Open bugs</b>\n\nNothing filed. Send /bug to report one.';
    }

    const lines = bugs.map(
      (bug) => `<b>#${bug.id}</b> · ${this.date(bug.reportedAt)}\n${this.escape(bug.text)}`,
    );

    return `🐞 <b>Open bugs (${bugs.length})</b>\n\n${lines.join('\n\n')}`;
  }

  /**
   * What the chat says when a report is closed. Each bug is quoted back, so the
   * message lands as the answer to something the user actually reported.
   */
  announcement(bugs: BugReport[]): string {
    const blocks = bugs.map((bug) => {
      const icon = bug.status === BugReportStatus.FIXED ? '🔧' : '🤷';
      const verdict = bug.status === BugReportStatus.FIXED ? 'Fixed' : 'Not fixing';
      const resolution = bug.resolution ? `\n${this.escape(bug.resolution)}` : '';

      return `${icon} <b>#${bug.id} — ${verdict}</b>\n<i>${this.escape(bug.text)}</i>${resolution}`;
    });

    const header = bugs.length === 1 ? 'Bug update' : `Bug updates (${bugs.length})`;
    return `<b>${header}</b>\n\n${blocks.join('\n\n')}`;
  }

  private date(value: Date): string {
    return value.toLocaleString('en-US', {
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
