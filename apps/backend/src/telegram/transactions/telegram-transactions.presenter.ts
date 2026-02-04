import { Injectable } from '@nestjs/common';
import { Transaction } from '@prisma/client';

@Injectable()
export class TelegramTransactionsPresenter {
  formatForReview(transaction: Transaction): string {
    const transactionDate = new Date(transaction.date);

    const dateString = transactionDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Caracas'
    });

    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = transactionDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Caracas'
    });

    return (
      `<b>Transaction Review</b>\n` +
      `\n` +
      `${date}\n` +
      `Time: ${time}\n` +
      `Amount: ${transaction.currency} ${transaction.amount}`
    );
  }

  formatRecentList(transactions: Transaction[]): string {
    if (transactions.length === 0) {
      return '📭 No expenses recorded.';
    }

    const recent = transactions.slice(0, 10);
    let message = `<b>Last ${recent.length} expenses:</b>\n\n`;

    recent.forEach((t) => {
      const statusIcon = this.getStatusIcon(t.status);
      const statusLabel = this.getStatusLabel(t.status);
      const platformLabel = this.getPlatformLabel(t.platform);
      const methodLabel = t.method ? this.getMethodLabel(t.method) : null;

      const transactionDate = new Date(t.date);
      const date = transactionDate.toLocaleDateString('es-VE', {
        timeZone: 'America/Caracas'
      });
      const time = transactionDate.toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Caracas'
      });

      if (t.description) {
        message += `<b>${t.description}</b>\n`;
        message += `   ${t.currency} ${t.amount}\n`;
        message += `   ${date} ${time}\n`;
        message += `   Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n`;
        message += `   ${statusIcon}${statusIcon ? ' ' : ''}${statusLabel}\n`;
      } else {
        message += `<b>${t.currency} ${t.amount}</b>\n`;
        message += `   ${date} ${time}\n`;
        message += `   Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n`;
        message += `   ${statusIcon}${statusIcon ? ' ' : ''}${statusLabel}\n`;
      }
      message += '\n';
    });

    return message;
  }

  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'NEW': '🆕',
      'REJECTED': '❌',
      'REGISTERED': '✅',
      'REVIEWED': '',
    };
    return icons[status] || '';
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'NEW': 'New',
      'REVIEWED': 'Reviewed',
      'REJECTED': 'Rejected',
      'REGISTERED': 'Registered',
    };
    return labels[status] || status;
  }

  private getPlatformLabel(platform: string): string {
    return platform === 'BANESCO' ? 'Banesco' : platform;
  }

  private getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'DEBIT_CARD': 'Debit Card',
      'PAGO_MOVIL': 'Pago Móvil',
    };
    return labels[method] || method;
  }
}
