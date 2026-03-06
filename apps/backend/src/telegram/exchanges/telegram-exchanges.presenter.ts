import { Injectable } from '@nestjs/common';
import { Exchange } from '@prisma/client';

@Injectable()
export class TelegramExchangesPresenter {
  formatRecentList(exchanges: Exchange[]): string {
    if (exchanges.length === 0) {
      return '📭 No exchanges recorded.';
    }

    const recent = exchanges.slice(0, 10);
    let message = `<b>Last ${recent.length} exchanges:</b>\n\n`;

    recent.forEach((e) => {
      const icon = e.tradeType === 'SELL' ? '💵' : '🪙';
      const tradeTypeLabel = e.tradeType === 'SELL' ? 'Sell' : 'Buy';
      const statusLabel = this.getStatusLabel(e.status);

      const date = new Date(e.binanceCreatedAt).toLocaleDateString('es-VE', {
        timeZone: 'UTC'
      });

      message += `ID: ${e.id}\n`;
      message += `${icon} <b>${e.asset} ${Number(e.amountGross).toFixed(2)}</b>\n`;
      message += `   → ${e.fiatSymbol} ${Number(e.fiatAmount).toFixed(2)}\n`;
      message += `   Rate: ${Number(e.exchangeRate).toFixed(2)} | ${date}\n`;
      message += `   Status: ${statusLabel} | ${tradeTypeLabel}\n`;
      if (e.counterparty) {
        message += `   👤 ${e.counterparty}\n`;
      }
      message += '\n';
    });

    return message;
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'COMPLETED': 'Completed',
      'PROCESSING': 'Processing',
      'PENDING': 'Pending',
      'CANCELLED': 'Cancelled',
      'FAILED': 'Failed',
      'REVIEWED': 'Reviewed',
      'REJECTED': 'Rejected',
      'REGISTERED': 'Registered',
    };
    return labels[status] || status;
  }
}
