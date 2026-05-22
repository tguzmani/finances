import { Injectable, Logger } from '@nestjs/common';
import { BudgetSubcategory } from './expenses-sheets.service';
import axios from 'axios';

@Injectable()
export class ExpensesChartService {
  private readonly logger = new Logger(ExpensesChartService.name);

  private readonly COLORS = {
    background: '#1e1e1e',
    text: '#e0e0e0',
  };

  private readonly SLICE_COLORS = [
    '#00d4aa', '#ff9f40', '#ff5a5f', '#36a2eb', '#9966ff',
    '#ffcd56', '#4bc0c0', '#ff6384', '#c9cbcf', '#7bc043',
    '#f37735', '#d11141', '#00b159', '#00aedb', '#ffc425',
    '#8e44ad', '#2ecc71', '#e67e22', '#1abc9c', '#e74c3c',
    '#3498db', '#f1c40f',
  ];

  private readonly QUICKCHART_URL = 'https://quickchart.io/chart';

  async generateExpensesChart(budgets: BudgetSubcategory[]): Promise<Buffer> {
    this.logger.log('Generating expenses pie chart');

    try {
      const filtered = budgets.filter((b) => b.expenditure > 0);

      const chartConfig = {
        type: 'pie',
        data: {
          labels: filtered.map((b) => b.subcategory),
          datasets: [
            {
              data: filtered.map((b) => b.expenditure),
              backgroundColor: filtered.map(
                (_, i) => this.SLICE_COLORS[i % this.SLICE_COLORS.length],
              ),
              borderColor: this.COLORS.background,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: true,
              position: 'right',
              labels: {
                color: this.COLORS.text,
                font: { size: 12, weight: 'bold' },
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle',
              },
            },
            title: {
              display: true,
              text: 'Expenses by Category',
              color: this.COLORS.text,
              font: { size: 20, weight: 'bold' },
              padding: { top: 10, bottom: 20 },
            },
            datalabels: {
              color: '#fff',
              font: { size: 11, weight: 'bold' },
              formatter: (value: number, ctx: any) => {
                const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const pct = ((value / total) * 100).toFixed(1);
                return `${pct}%`;
              },
            },
          },
        },
      };

      const url = `${this.QUICKCHART_URL}?width=1200&height=700&version=4&backgroundColor=${encodeURIComponent(this.COLORS.background)}&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

      this.logger.log('Requesting pie chart from QuickChart API');
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      const buffer = Buffer.from(response.data);
      this.logger.log(`Pie chart generated successfully (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to generate expenses chart: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
