import { Injectable } from '@nestjs/common';
import { EquitySnapshot } from '@prisma/client';

@Injectable()
export class TelegramEquityPresenter {
  formatEquityMessage(snapshots: EquitySnapshot[]): string {
    if (snapshots.length === 0) {
      return '<b>Equity</b>\n\n<i>No snapshots available yet.</i>';
    }

    let message = '<b>Equity</b>\n\n';

    for (const snapshot of snapshots) {
      const label = this.getLabel(snapshot.name);
      const amount = Number(snapshot.amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      message += `${label}: <b>$${amount}</b>\n`;
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
