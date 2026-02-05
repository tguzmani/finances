import { Injectable } from '@nestjs/common';
import { Transaction, TransactionGroup } from '@prisma/client';

@Injectable()
export class TelegramTransactionsPresenter {
  formatForReview(transaction: Transaction, exchangeRate?: number): string {
    const transactionDate = new Date(transaction.date);

    const dateString = transactionDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });

    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = transactionDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    const typeIcon = this.getTypeIcon(transaction.type);
    const typeLabel = this.getTypeLabel(transaction.type);
    let amountText = `Amount: ${transaction.currency} ${Number(transaction.amount).toFixed(2)}`;

    // Add USD conversion if exchangeRate is available
    if (exchangeRate && transaction.currency === 'VES') {
      const usdAmount = Number(transaction.amount) / exchangeRate;
      amountText += `\nUSD ${usdAmount.toFixed(2)}`;
    }

    // Add type
    const typeText = `\nType: ${typeIcon} ${typeLabel}`;

    // Add status
    const statusLabel = this.getStatusLabel(transaction.status);
    const statusText = `\nStatus: ${statusLabel}`;

    // Add description if exists
    const descriptionText = transaction.description
      ? `\nDescription: ${transaction.description}`
      : '';

    return (
      `<b>Transaction Review</b>\n` +
      `\n` +
      `${date}\n` +
      `Time: ${time}\n` +
      amountText +
      typeText +
      statusText +
      descriptionText
    );
  }

  formatRecentList(transactions: (Transaction & { group?: TransactionGroup | null })[], exchangeRate?: number): string {
    if (transactions.length === 0) {
      return '📭 No transactions recorded.';
    }

    const recent = transactions.slice(0, 10);
    let message = `<b>Last ${recent.length} transactions:</b>\n\n`;

    recent.forEach((t) => {
      const statusIcon = this.getStatusIcon(t.status);
      const statusLabel = this.getStatusLabel(t.status);
      const platformLabel = this.getPlatformLabel(t.platform);
      const methodLabel = t.method ? this.getMethodLabel(t.method) : null;
      const typeIcon = this.getTypeIcon(t.type);

      const transactionDate = new Date(t.date);
      const date = transactionDate.toLocaleDateString('es-VE', {
        timeZone: 'UTC'
      });
      const time = transactionDate.toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      });

      // Format amounts with 2 decimals
      const vesAmount = Number(t.amount).toFixed(2);
      const usdAmount = exchangeRate && t.currency === 'VES'
        ? ` (USD ${(Number(t.amount) / exchangeRate).toFixed(2)})`
        : '';

      message += `ID: ${t.id}\n`;
      if (t.description) {
        message += `<b>${typeIcon} ${t.description}</b>\n`;
        message += `   ${t.currency} ${vesAmount}${usdAmount}\n`;
        message += `   ${date} ${time}\n`;
        message += `   Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n`;
        message += `   ${statusIcon}${statusIcon ? ' ' : ''}${statusLabel}\n`;
        if (t.group) {
          message += `   📦 Group: ${t.group.description}\n`;
        }
      } else {
        message += `<b>${typeIcon} ${t.currency} ${vesAmount}${usdAmount}</b>\n`;
        message += `   ${date} ${time}\n`;
        message += `   Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n`;
        message += `   ${statusIcon}${statusIcon ? ' ' : ''}${statusLabel}\n`;
        if (t.group) {
          message += `   📦 Group: ${t.group.description}\n`;
        }
      }
      message += '\n';
    });

    return message;
  }

  formatForNotification(transaction: Transaction, exchangeRate?: number): string {
    const transactionDate = new Date(transaction.date);

    const dateString = transactionDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });

    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = transactionDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    const typeIcon = this.getTypeIcon(transaction.type);
    const vesAmount = Number(transaction.amount).toFixed(2);
    let usdAmount = '';

    if (exchangeRate && transaction.currency === 'VES') {
      const usd = (Number(transaction.amount) / exchangeRate).toFixed(2);
      usdAmount = ` (USD ${usd})`;
    }

    const descriptionLine = transaction.description
      ? `\n<b>${transaction.description}</b>`
      : '';

    const platformLabel = this.getPlatformLabel(transaction.platform);

    return (
      `${typeIcon} <b>New Transaction</b>${descriptionLine}\n\n` +
      `${transaction.currency} ${vesAmount}${usdAmount}\n` +
      `${date}\n` +
      `Time: ${time}\n` +
      `Platform: ${platformLabel}`
    );
  }

  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'NEW': '🆕',
      'REJECTED': '❌',
      'REGISTERED': '✅',
      'REVIEWED': '✏️',
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
    const labels: Record<string, string> = {
      'BANESCO': 'Banesco',
      'BANK_OF_AMERICA': 'Bank of America',
      'BINANCE': 'Binance',
      'WALLET': 'Wallet',
      'CASH_BOX': 'Cash Box',
    };
    return labels[platform] || platform;
  }

  private getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'DEBIT_CARD': 'Debit Card',
      'PAGO_MOVIL': 'Pago Móvil',
      'ZELLE': 'Zelle',
      'CREDIT_CARD': 'Credit Card',
      'BINANCE_PAY': 'Binance Pay',
      'DEPOSIT': 'Deposit',
      'WITHDRAWAL': 'Withdrawal',
    };
    return labels[method] || method;
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'EXPENSE': '💸',
      'INCOME': '💰',
    };
    return icons[type] || '💵';
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'EXPENSE': 'Expense',
      'INCOME': 'Income',
    };
    return labels[type] || type;
  }
}
