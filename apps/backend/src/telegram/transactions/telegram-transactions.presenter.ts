import { Injectable } from '@nestjs/common';
import { Transaction } from '@prisma/client';

/** Asked whenever a transaction needs a name before it can be registered. */
export const DESCRIPTION_PROMPT = '✏️ Please type a description for this transaction:';

@Injectable()
export class TelegramTransactionsPresenter {
  formatForReview(transaction: Transaction, exchangeRate?: number): string {
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

  formatRecentList(transactions: Transaction[], exchangeRate?: number): string {
    if (transactions.length === 0) {
      return '📭 No transactions recorded.';
    }

    const recent = transactions.slice(0, 10);
    let message = `<b>Last ${recent.length} transactions:</b>\n\n`;

    recent.forEach((t) => {
      message += this.formatListEntry(t, { exchangeRate });
    });

    return message;
  }

  /**
   * Search results, as /find shows them: one hit per pair of lines, so the
   * answer to "do I have this?" reads at a glance instead of scrolling.
   *
   * With an amount asked for, each hit states how far off it is. A search for
   * 6,080 that turns up 6,080.86 is almost certainly the transaction being
   * looked for, and the difference is what says so.
   */
  formatFoundList(
    transactions: Transaction[],
    params: { askedAmount?: number; exchangeRate?: number } = {},
  ): string {
    if (transactions.length === 0) {
      return '🔍 Nothing found.';
    }

    const header = `🔍 <b>Found ${transactions.length} transaction(s)</b>\n\n`;

    const entries = transactions.map((t) => {
      const amount = Number(t.amount);
      const usd =
        params.exchangeRate && t.currency === 'VES'
          ? ` ≈ $${(amount / params.exchangeRate).toFixed(2)}`
          : '';
      const date = new Date(t.date).toLocaleDateString('es-VE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Caracas',
      });

      return (
        `${this.getStatusIcon(t.status)} <b>${t.currency} ${this.formatAmount(amount)}</b>` +
        `${this.formatDifference(t, params.askedAmount)} · ${t.description || 'No description'}\n` +
        `   ${date} · ${this.getPlatformLabel(t.platform)}${usd} · ` +
        `${this.getStatusLabel(t.status)} · #${t.id}`
      );
    });

    return header + entries.join('\n\n');
  }

  private formatAmount(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /** One transaction, as the lists show it. */
  private formatListEntry(
    t: Transaction,
    params: { askedAmount?: number; exchangeRate?: number },
  ): string {
    const { askedAmount, exchangeRate } = params;
    const statusIcon = this.getStatusIcon(t.status);
    const statusLabel = this.getStatusLabel(t.status);
    const platformLabel = this.getPlatformLabel(t.platform);
    const methodLabel = t.method ? this.getMethodLabel(t.method) : null;
    const typeIcon = this.getTypeIcon(t.type);

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

    // Format amounts with 2 decimals
    const vesAmount = Number(t.amount).toFixed(2);
    const usdAmount = exchangeRate && t.currency === 'VES'
      ? ` (USD ${(Number(t.amount) / exchangeRate).toFixed(2)})`
      : '';
    const difference = this.formatDifference(t, askedAmount);

    let message = `ID: ${t.id}\n`;
    if (t.description) {
      message += `<b>${typeIcon} ${t.description}</b>\n`;
      message += `   ${t.currency} ${vesAmount}${usdAmount}${difference}\n`;
    } else {
      message += `<b>${typeIcon} ${t.currency} ${vesAmount}${usdAmount}</b>${difference}\n`;
    }
    message += `   ${date} ${time}\n`;
    message += `   Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n`;
    message += `   ${statusIcon}${statusIcon ? ' ' : ''}${statusLabel}\n`;

    return message + '\n';
  }

  /** How far a hit sits from the amount that was asked for. */
  private formatDifference(t: Transaction, askedAmount?: number): string {
    if (!askedAmount) return '';

    const difference = Number(t.amount) - askedAmount;
    if (Math.abs(difference) < 0.005) return ' <i>(exact)</i>';

    const sign = difference > 0 ? '+' : '−';
    return ` <i>(${sign}${Math.abs(difference).toFixed(2)})</i>`;
  }

  formatForNotification(transaction: Transaction, exchangeRate?: number): string {
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
