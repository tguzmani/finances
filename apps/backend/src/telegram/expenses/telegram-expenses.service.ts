import { Injectable, Logger } from '@nestjs/common';
import { ExpensesSheetsService } from '../../expenses/expenses-sheets.service';
import { ExpensesChartService } from '../../expenses/expenses-chart.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TelegramExpensesPresenter } from './telegram-expenses.presenter';

@Injectable()
export class TelegramExpensesService {
  private readonly logger = new Logger(TelegramExpensesService.name);

  constructor(
    private readonly expensesSheetsService: ExpensesSheetsService,
    private readonly expensesChartService: ExpensesChartService,
    private readonly transactionsService: TransactionsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly presenter: TelegramExpensesPresenter,
  ) {}

  async getOverviewMessage(): Promise<string> {
    try {
      const [summary, estimatedExpenditure] = await Promise.all([
        this.expensesSheetsService.getSummary(),
        this.getEstimatedExpenditureInUsd(),
      ]);

      return this.presenter.formatOverview(summary, estimatedExpenditure);
    } catch (error) {
      this.logger.error(`Failed to get overview message: ${error.message}`);
      throw error;
    }
  }

  async getDetailedMessage(): Promise<string> {
    try {
      const [budgets, estimatedExpenditure] = await Promise.all([
        this.expensesSheetsService.getBudgets(),
        this.getEstimatedExpenditureInUsd(),
      ]);

      if (estimatedExpenditure !== 0) {
        budgets.push({
          subcategory: 'Unregistered',
          expenditure: estimatedExpenditure,
          available: 0,
          percentUsed: 0,
        });
      }

      return this.presenter.formatDetailed(budgets);
    } catch (error) {
      this.logger.error(`Failed to get detailed message: ${error.message}`);
      throw error;
    }
  }

  async getExpensesChart(): Promise<Buffer> {
    try {
      const [budgets, estimatedExpenditure] = await Promise.all([
        this.expensesSheetsService.getBudgets(),
        this.getEstimatedExpenditureInUsd(),
      ]);

      if (estimatedExpenditure > 0) {
        budgets.push({
          subcategory: 'Unregistered',
          expenditure: estimatedExpenditure,
          available: 0,
          percentUsed: 0,
        });
      }

      return this.expensesChartService.generateExpensesChart(budgets);
    } catch (error) {
      this.logger.error(`Failed to generate expenses chart: ${error.message}`);
      throw error;
    }
  }

  private async getEstimatedExpenditureInUsd(): Promise<number> {
    const byCurrency = await this.transactionsService.getUnregisteredExpenditure();

    let totalUsd = 0;

    for (const { currency, net } of byCurrency) {
      if (currency === 'USD' || currency === 'USDT') {
        totalUsd += net;
      } else if (currency === 'VES') {
        const rate = await this.exchangeRateService.findLatest();
        const rateValue = rate ? Number(rate.value) : 1;
        totalUsd += rateValue > 0 ? net / rateValue : 0;
      } else {
        totalUsd += net;
      }
    }

    return totalUsd;
  }
}
