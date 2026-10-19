import { Injectable } from '@nestjs/common';
import { MovementMatch, ReconcileReport, StatementMovement } from './telegram-reconcile.service';

export const RECONCILE_PROMPT =
  '🧾 <b>Statement check</b>\n\n' +
  'Paste the rows of your Banesco movements and I tell you which ones are on record and which are not.\n\n' +
  '<i>The running balance column is ignored, and a row you mark with "xx" is left out.</i>';

@Injectable()
export class TelegramReconcilePresenter {
  /**
   * What is missing comes first: it is the only part that asks for anything to
   * be done. Each group carries its own total, because how much is unaccounted
   * for matters as much as how many rows are.
   */
  formatReport(report: ReconcileReport): string {
    const { matches, rate } = report;

    if (matches.length === 0) {
      return '🧾 No movements read from that text. Paste the rows as they come, columns and all.';
    }

    const missing = matches.filter((m) => m.verdict === 'missing');
    const close = matches.filter((m) => m.verdict === 'close');
    const exact = matches.filter((m) => m.verdict === 'exact');

    const sections: string[] = [
      `🧾 <b>Statement check</b> — ${matches.length} movement(s)`,
    ];

    if (missing.length > 0) {
      sections.push(
        this.formatSection(
          `❌ <b>Not on record (${missing.length})</b>`,
          missing.map((m) => this.formatMovement(m.movement)),
          missing,
          rate,
        ),
      );
    }

    if (close.length > 0) {
      sections.push(
        this.formatSection(
          `⚠️ <b>Close, not exact (${close.length})</b>`,
          close.map((m) => this.formatClose(m)),
          close,
          rate,
        ),
      );
    }

    if (exact.length > 0) {
      sections.push(
        this.formatSection(
          `✅ <b>On record (${exact.length})</b>`,
          exact.map((m) => this.formatFound(m)),
          exact,
          rate,
        ),
      );
    }

    return sections.join('\n\n');
  }

  private formatSection(
    header: string,
    lines: string[],
    matches: MovementMatch[],
    rate?: number,
  ): string {
    return `${header}\n${lines.join('\n')}\n${this.formatTotal(matches, rate)}`;
  }

  /** What the group adds up to, as the statement counts it and in USD. */
  private formatTotal(matches: MovementMatch[], rate?: number): string {
    const total = matches.reduce((sum, m) => sum + m.movement.amount, 0);
    const usd = rate ? ` ≈ ${this.formatSigned(total / rate)} USD` : '';

    return `<b>Total: ${this.formatSigned(total)} Bs${usd}</b>`;
  }

  private formatMovement(movement: StatementMovement): string {
    const fee = movement.parts.length > 1 ? ' <i>(fee included)</i>' : '';
    return `• (${this.formatDate(movement.date)}) ${movement.description}: ${this.formatSigned(movement.amount)}${fee}`;
  }

  private formatClose(match: MovementMatch): string {
    const difference = match.difference ?? 0;

    return (
      `${this.formatMovement(match.movement)}\n` +
      `   #${match.transaction!.id} "${match.transaction!.description ?? 'No description'}" ` +
      `has ${this.formatNumber(Number(match.transaction!.amount))} (${this.formatSigned(difference)})`
    );
  }

  private formatFound(match: MovementMatch): string {
    const found = match.exchange
      ? `P2P sale <i>(order ${match.exchange.orderNumber})</i>`
      : `${match.transaction!.description ?? 'No description'} <i>(#${match.transaction!.id})</i>`;

    return `${this.formatMovement(match.movement)} → ${found}`;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Caracas',
    });
  }

  /** A figure with the sign the statement gives it. */
  private formatSigned(amount: number): string {
    const sign = amount < 0 ? '−' : '+';
    return `${sign}${this.formatNumber(Math.abs(amount))}`;
  }

  private formatNumber(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
