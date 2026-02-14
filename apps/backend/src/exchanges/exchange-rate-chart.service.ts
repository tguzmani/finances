import { Injectable, Logger } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRateSource } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class ExchangeRateChartService {
  private readonly logger = new Logger(ExchangeRateChartService.name);

  // Dark theme colors
  private readonly COLORS = {
    background: '#1e1e1e',
    text: '#e0e0e0',
    grid: 'rgba(255, 255, 255, 0.08)',
    internal: '#00d4aa', // Cyan/teal for internal rates
    binance: '#ff9f40', // Orange for Binance P2P
    bcv: '#ff5a5f', // Red for BCV official rate
  };

  // QuickChart API endpoint
  private readonly QUICKCHART_URL = 'https://quickchart.io/chart';

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Generate exchange rates chart for the last N days
   * @param days Number of days to include (default: 30)
   * @returns PNG image buffer
   */
  async generateRatesChart(days: number = 30): Promise<Buffer> {
    this.logger.log(`Generating exchange rates chart for last ${days} days`);

    try {
      // Get all rates
      const allRates = await this.exchangeRateService.findAll();

      // Filter by date range
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentRates = allRates.filter((r) => r.date >= cutoffDate);

      // Separate by source and sort by date
      const internalRates = recentRates
        .filter((r) => r.source === ExchangeRateSource.INTERNAL)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const binanceRates = recentRates
        .filter((r) => r.source === ExchangeRateSource.BINANCE_P2P)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const bcvRates = recentRates
        .filter((r) => r.source === ExchangeRateSource.BCV)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      this.logger.log(
        `Found ${internalRates.length} internal, ${binanceRates.length} Binance P2P, and ${bcvRates.length} BCV rates`
      );

      // Build Chart.js configuration with dark theme
      const chartConfig = {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Internal Rate',
              data: internalRates.map((r) => ({
                x: r.date.toISOString(),
                y: Number(r.value),
              })),
              borderColor: this.COLORS.internal,
              backgroundColor: this.COLORS.internal + '20',
              borderWidth: 3,
              tension: 0.3,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: this.COLORS.internal,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
            },
            {
              label: 'Binance P2P',
              data: binanceRates.map((r) => ({
                x: r.date.toISOString(),
                y: Number(r.value),
              })),
              borderColor: this.COLORS.binance,
              backgroundColor: this.COLORS.binance + '20',
              borderWidth: 2,
              tension: 0.4,
              pointRadius: 0, // No points for high-frequency data
              pointHoverRadius: 5,
              pointBackgroundColor: this.COLORS.binance,
            },
            {
              label: 'BCV Official',
              data: bcvRates.map((r) => ({
                x: r.date.toISOString(),
                y: Number(r.value),
              })),
              borderColor: this.COLORS.bcv,
              backgroundColor: this.COLORS.bcv + '20',
              borderWidth: 3,
              tension: 0.3,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: this.COLORS.bcv,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
            },
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
                font: {
                  size: 14,
                  weight: 'bold',
                },
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle',
              },
            },
            title: {
              display: true,
              text: `Exchange Rates - Last ${days} Days`,
              color: this.COLORS.text,
              font: {
                size: 20,
                weight: 'bold',
              },
              padding: {
                top: 10,
                bottom: 30,
              },
            },
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: days <= 7 ? 'day' : 'day',
                displayFormats: {
                  day: 'MMM D',
                },
                tooltipFormat: 'MMM D, YYYY HH:mm',
              },
              grid: {
                color: this.COLORS.grid,
                display: true,
              },
              ticks: {
                color: this.COLORS.text,
                font: {
                  size: 12,
                },
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
                text: 'VES per USD',
                color: this.COLORS.text,
                font: {
                  size: 14,
                  weight: 'bold',
                },
              },
              grid: {
                color: this.COLORS.grid,
              },
              ticks: {
                color: this.COLORS.text,
                font: {
                  size: 12,
                },
              },
            },
          },
        },
      };

      // Build QuickChart URL
      const url = `${this.QUICKCHART_URL}?width=1200&height=700&version=4&backgroundColor=${encodeURIComponent(this.COLORS.background)}&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;

      // Fetch chart image from QuickChart
      this.logger.log('Requesting chart from QuickChart API');
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 second timeout
      });

      const buffer = Buffer.from(response.data);

      this.logger.log(`Chart generated successfully (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(
        `Failed to generate chart: ${(error as Error).message}`,
        (error as Error).stack
      );
      throw error;
    }
  }
}
