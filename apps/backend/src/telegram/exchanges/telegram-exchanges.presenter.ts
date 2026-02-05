import { Injectable } from '@nestjs/common';
import { Exchange } from '@prisma/client';

interface RegisterMetrics {
  terminalList: string;
  wavg: number;
  sumFormula: string;
  totalAmount: number;
  count: number;
}

@Injectable()
export class TelegramExchangesPresenter {
  formatForReview(exchange: Exchange): string {
    const exchangeDate = new Date(exchange.binanceCreatedAt);

    const dateString = exchangeDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });

    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = exchangeDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    const tradeType = exchange.tradeType === 'SELL' ? 'Sell' : 'Buy';
    const icon = exchange.tradeType === 'SELL' ? '💵' : '🪙';
    const last4Digits = exchange.orderNumber.slice(-4);

    return (
      `<b>Exchange Review</b>\n` +
      `\n` +
      `${icon} <b>${tradeType}: ${exchange.asset} ${Number(exchange.amountGross).toFixed(2)}</b>\n` +
      `→ ${exchange.fiatSymbol} ${Number(exchange.fiatAmount).toFixed(2)}\n` +
      `Rate: ${Number(exchange.exchangeRate).toFixed(2)}\n` +
      `Order: ${last4Digits}\n` +
      `${date}\n` +
      `Time: ${time}\n` +
      (exchange.counterparty ? `Counterparty: ${exchange.counterparty}\n` : '')
    );
  }

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

  formatRegisterSummary(metrics: RegisterMetrics): string {
    return (
      `<b>Register Exchanges</b>\n\n` +
      `📊 <b>Summary:</b>\n` +
      `Total exchanges: ${metrics.count}\n` +
      `Total USD: ${metrics.totalAmount}\n` +
      `Weighted Avg Rate: ${metrics.wavg} VES/USD\n\n` +
      `Use the buttons below to copy data:`
    );
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
