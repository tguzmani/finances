import { Injectable } from '@nestjs/common';
import { Transaction, TransactionGroup } from '@prisma/client';
import { GroupAmountCalculation } from '../../transaction-groups/transaction-group.types';

@Injectable()
export class TelegramGroupsPresenter {
  formatGroupForDisplay(
    group: TransactionGroup & { transactions: Transaction[] },
    calculation: GroupAmountCalculation,
    groupDate: Date,
    exchangeRate?: number
  ): string {
    let message = `<b>📦 ${group.description}</b>\n\n`;

    // Show transactions (changed from "Members")
    message += `<b>Transactions:</b>\n`;

    for (const tx of group.transactions) {
      const txDate = new Date(tx.date);

      const date = txDate.toLocaleDateString('es-VE', { timeZone: 'UTC' });
      const time = txDate.toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      });

      const amount = Number(tx.amount).toFixed(2);
      const icon = tx.type === 'INCOME' ? '💰' : '💸';
      const description = tx.description || 'N/A';

      message += `  ${icon} ${description} - ${amount} ${tx.currency}\n`;
      message += `     ID: ${tx.id} | ${date} ${time}\n`;
    }

    // Show group total if it has monetary value
    if (calculation.hasMonetaryValue && calculation.type !== 'NEUTRAL') {
      message += `\n<b>Group Total:</b>\n`;
      message += `Type: ${calculation.type === 'INCOME' ? '💰 Income' : '💸 Expense'}\n`;

      // Show VES amount if applicable
      if (calculation.currency === 'VES' && exchangeRate) {
        let vesIncome = 0;
        let vesExpense = 0;
        for (const tx of group.transactions) {
          if (tx.currency === 'VES') {
            if (tx.type === 'INCOME') {
              vesIncome += Number(tx.amount);
            } else {
              vesExpense += Number(tx.amount);
            }
          }
        }
        const vesNet = vesIncome - vesExpense;
        const vesTotal = Math.abs(vesNet);
        message += `Amount: ${vesTotal.toFixed(2)} VES → ${calculation.totalAmount.toFixed(2)} USD\n`;
      } else if (calculation.currency === 'MIXED') {
        message += `Amount: ${calculation.totalAmount.toFixed(2)} USD (converted)\n`;
      } else {
        message += `Amount: ${calculation.totalAmount.toFixed(2)} USD\n`;
      }

      const dateFormatted = `${groupDate.getUTCDate()}-${groupDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}`;
      message += `Date: ${dateFormatted}`;
    } else {
      // NEUTRAL group
      message += `\nℹ️ No net monetary value (incomes equal expenses).\n`;
      message += `No Excel formula needed.`;
    }

    return message;
  }
}
