import { Injectable } from '@nestjs/common';
import { ExpensesSummary, BudgetSubcategory } from '../../expenses/expenses-sheets.service';

@Injectable()
export class TelegramExpensesPresenter {
  formatOverview(summary: ExpensesSummary, estimatedExpenditure: number): string {
    const combinedExpenditure = summary.totalExpenditure + estimatedExpenditure;

    let message = '<b>Expenses Overview</b>\n\n';
    message += '<b>Registered</b>\n';
    message += `Budget: <b>$${summary.budget.toFixed(2)}</b>\n`;
    message += `Total Expenditure: <b>$${summary.totalExpenditure.toFixed(2)}</b>\n`;
    message += `Available: <b>$${summary.available.toFixed(2)}</b>\n`;
    message += `Savings Rate: <b>${summary.savingsRate.toFixed(1)}%</b>\n\n`;
    message += '<b>Unregistered</b>\n';
    message += `Estimated Expenditure: <b>$${estimatedExpenditure.toFixed(2)}</b>\n`;
    message += `Combined Expenditure: <b>$${combinedExpenditure.toFixed(2)}</b>\n`;
    const combinedSavingsRate = summary.income > 0
      ? (1 - combinedExpenditure / summary.income) * 100
      : 0;
    message += `Savings Rate: <b>${combinedSavingsRate.toFixed(1)}%</b>`;
    return message;
  }

  formatDetailed(budgets: BudgetSubcategory[]): string {
    let message = '<b>Expenses by Category</b>\n\n';

    for (const b of budgets) {
      const bar = this.buildProgressBar(b.percentUsed);
      message += `<b>${b.subcategory}</b>\n`;
      message += `${bar} ${b.percentUsed.toFixed(0)}%\n`;
      message += `Spent: $${b.expenditure.toFixed(2)} | Available: $${b.available.toFixed(2)}\n\n`;
    }

    return message;
  }

  private buildProgressBar(percent: number): string {
    const total = 10;
    const filled = Math.min(Math.round((percent / 100) * total), total);
    const empty = total - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }
}
