import { Injectable, Logger } from '@nestjs/common';
import { EquityName } from '@prisma/client';
import { EquityService } from './equity.service';
import axios from 'axios';

@Injectable()
export class EquityChartService {
  private readonly logger = new Logger(EquityChartService.name);

  private readonly COLORS = {
    background: '#1e1e1e',
    text: '#e0e0e0',
    grid: 'rgba(255, 255, 255, 0.08)',
    simple: '#00d4aa',
    crypto: '#ff9f40',
    fiat: '#5b8ff9',
    full: '#ff5a5f',
  };

  private readonly QUICKCHART_URL = 'https://quickchart.io/chart';

  constructor(private readonly equityService: EquityService) {}

  async generateEquityChart(days: number = 30): Promise<Buffer> {
    this.logger.log(`Generating equity chart for last ${days} days`);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshots = await this.equityService.findByDateRange(startDate, endDate);

      const byName = (name: EquityName) =>
        snapshots
          .filter((s) => s.name === name)
          .map((s) => ({ x: s.date.toISOString(), y: Number(s.amount) }));

      const makeDataset = (label: string, name: EquityName, color: string) => ({
        label,
        data: byName(name),
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      });

      const chartConfig = {
        type: 'line',
        data: {
          datasets: [
            makeDataset('Simple', EquityName.EQUITY_SIMPLE, this.COLORS.simple),
            makeDataset('Crypto Investment', EquityName.EQUITY_CRYPTO_INVESTMENT, this.COLORS.crypto),
            makeDataset('Fiat Investment', EquityName.EQUITY_FIAT_INVESTMENT, this.COLORS.fiat),
            makeDataset('Full Investment', EquityName.EQUITY_FULL_INVESTMENT, this.COLORS.full),
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: this.COLORS.text,
                font: { size: 14, weight: 'bold' },
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle',
              },
            },
            title: {
              display: true,
              text: `Equity - Last ${days} Days`,
              color: this.COLORS.text,
              font: { size: 20, weight: 'bold' },
              padding: { top: 10, bottom: 30 },
            },
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: { day: 'MMM D' },
                tooltipFormat: 'MMM D, YYYY',
              },
              grid: { color: this.COLORS.grid, display: true },
              ticks: {
                color: this.COLORS.text,
                font: { size: 12 },
                maxRotation: 45,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 10,
              },
              display: true,
            },
            y: {
              title: {
                display: true,
                text: 'USD',
                color: this.COLORS.text,
                font: { size: 14, weight: 'bold' },
              },
              grid: { color: this.COLORS.grid },
              ticks: { color: this.COLORS.text, font: { size: 12 } },
            },
          },
        },
      };

      const url = `${this.QUICKCHART_URL}?width=1200&height=700&version=4&backgroundColor=${encodeURIComponent(this.COLORS.background)}&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

      this.logger.log('Requesting chart from QuickChart API');
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      const buffer = Buffer.from(response.data);
      this.logger.log(`Chart generated successfully (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to generate chart: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }
}
