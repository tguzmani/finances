import { Injectable } from '@nestjs/common';
import { EquitySnapshot } from '@prisma/client';

/** The figure the others are measured against. */
const SIMPLE_EQUITY = 'EQUITY_SIMPLE';

@Injectable()
export class TelegramEquityPresenter {
  formatEquityMessage(snapshots: EquitySnapshot[]): string {
    if (snapshots.length === 0) {
      return '<b>Equity</b>\n\n<i>No snapshots available yet.</i>';
    }

    let message = '<b>Equity</b>\n\n';

    const simple = snapshots.find((s) => s.name === SIMPLE_EQUITY);
    const baseline = simple ? Number(simple.amount) : null;

    for (const snapshot of snapshots) {
      const label = this.getLabel(snapshot.name);
      const amount = Number(snapshot.amount);
      message += `${label}: <b>$${this.formatAmount(amount)}</b>${this.formatGap(snapshot, amount, baseline)}\n`;
    }

    const timestamp = snapshots[0].date.toLocaleString('es-VE', {
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

  /**
   * What an investment figure is worth over or under the simple one.
   *
   * Simple is cash as it stands; the others carry what the investments are
   * marked at. Side by side the four figures say little, while the gap says
   * what holding them has done.
   */
  private formatGap(
    snapshot: EquitySnapshot,
    amount: number,
    baseline: number | null,
  ): string {
    if (baseline === null || snapshot.name === SIMPLE_EQUITY) return '';

    const gap = amount - baseline;
    const sign = gap < 0 ? '−' : '+';

    return ` <i>($${sign}${this.formatAmount(Math.abs(gap))})</i>`;
  }

  private formatAmount(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private getLabel(name: string): string {
    switch (name) {
      case 'EQUITY_SIMPLE':
        return 'Simple';
      case 'EQUITY_CRYPTO_INVESTMENT':
        return 'Crypto Investment';
      case 'EQUITY_FIAT_INVESTMENT':
        return 'Fiat Investment';
      case 'EQUITY_FULL_INVESTMENT':
        return 'Full Investment';
      default:
        return name;
    }
  }
}
