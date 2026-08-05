import { Injectable, Logger } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRate, ExchangeRateSource } from '@prisma/client';
import axios from 'axios';

/**
 * Chart display modes:
 * - absolute: raw rate values (VES per USD/EUR)
 * - discount: BCV discount vs Binance/Internal, as a percentage
 */
export type RatesChartMode = 'absolute' | 'discount';

interface ChartPoint {
  x: string;
  y: number;
}

interface ChartDataset {
  label: string;
  data: ChartPoint[];
  color: string;
  /** Show a marker every Nth point (default: every point) */
  markerEvery?: number;
}

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
    bcv: '#ff5a5f', // Red for BCV official USD rate
    bcvEur: '#a855f7', // Purple for BCV official EUR rate
  };

  // QuickChart API endpoint
  private readonly QUICKCHART_URL = 'https://quickchart.io/chart';

  // Placeholder swapped for a real JS callback in serializeChartConfig()
  private readonly POINT_LABEL_FORMATTER_TOKEN = '__POINT_LABEL_FORMATTER__';

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Generate exchange rates chart for the last N days
   * @param days Number of days to include (default: 30)
   * @param mode Absolute rates or BCV discount percentages (default: absolute)
   * @returns PNG image buffer
   */
  async generateRatesChart(
    days: number = 30,
    mode: RatesChartMode = 'absolute'
  ): Promise<Buffer> {
    this.logger.log(`Generating ${mode} exchange rates chart for last ${days} days`);

    try {
      const allRates = await this.exchangeRateService.findAll();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const datasets =
        mode === 'discount'
          ? this.buildDiscountDatasets(allRates, cutoffDate, days)
          : this.buildAbsoluteDatasets(allRates, cutoffDate);

      const chartConfig = this.buildChartConfig({
        datasets,
        title:
          mode === 'discount'
            ? `BCV Discounts - Last ${days} Days`
            : `Exchange Rates - Last ${days} Days`,
        yAxisLabel: mode === 'discount' ? 'Discount %' : 'VES per USD',
        // Discount values are readable as text; absolute rates would just clutter
        pointLabels: mode === 'discount',
      });

      const url = `${this.QUICKCHART_URL}?width=1200&height=700&version=4&backgroundColor=${encodeURIComponent(this.COLORS.background)}&c=${encodeURIComponent(this.serializeChartConfig(chartConfig))}`;

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

  /**
   * One series per source, using the raw stored values
   */
  private buildAbsoluteDatasets(
    allRates: ExchangeRate[],
    cutoffDate: Date
  ): ChartDataset[] {
    const recentRates = allRates.filter((r) => r.date >= cutoffDate);

    const internalRates = this.sortedBySource(recentRates, ExchangeRateSource.INTERNAL);
    const binanceRates = this.sortedBySource(recentRates, ExchangeRateSource.BINANCE_P2P);
    const bcvRates = this.sortedBySource(recentRates, ExchangeRateSource.BCV);
    const bcvEurRates = this.sortedBySource(recentRates, ExchangeRateSource.BCV_EUR);

    this.logger.log(
      `Found ${internalRates.length} internal, ${binanceRates.length} Binance P2P, ${bcvRates.length} BCV USD, and ${bcvEurRates.length} BCV EUR rates`
    );

    const toPoints = (rates: ExchangeRate[]): ChartPoint[] =>
      rates.map((r) => ({ x: r.date.toISOString(), y: Number(r.value) }));

    return [
      {
        label: 'Internal Rate',
        data: toPoints(internalRates),
        color: this.COLORS.internal,
      },
      {
        label: 'Binance P2P',
        data: toPoints(binanceRates),
        color: this.COLORS.binance,
        markerEvery: 6,
      },
      {
        label: 'BCV USD',
        data: toPoints(bcvRates),
        color: this.COLORS.bcv,
      },
      {
        label: 'BCV EUR',
        data: toPoints(bcvEurRates),
        color: this.COLORS.bcvEur,
      },
    ];
  }

  /**
   * Daily BCV discount series against Binance and the Internal rate.
   *
   * Sources are recorded at different frequencies (BCV is daily, Binance P2P is
   * intraday, Internal is sporadic), so values are bucketed per Caracas day and
   * forward-filled from the last known value before computing the discount.
   */
  private buildDiscountDatasets(
    allRates: ExchangeRate[],
    cutoffDate: Date,
    days: number
  ): ChartDataset[] {
    const bcvUsd = this.buildDailySeries(allRates, ExchangeRateSource.BCV, cutoffDate);
    const bcvEur = this.buildDailySeries(allRates, ExchangeRateSource.BCV_EUR, cutoffDate);
    const binance = this.buildDailySeries(allRates, ExchangeRateSource.BINANCE_P2P, cutoffDate);
    const internal = this.buildDailySeries(allRates, ExchangeRateSource.INTERNAL, cutoffDate);

    const timeline = this.buildTimeline(cutoffDate, days);

    // Same formula as ExchangeRatesAggregatorService.calculateDiscounts()
    const discountSeries = (
      bcvSeries: Map<string, number>,
      compareSeries: Map<string, number>
    ): ChartPoint[] => {
      const points: ChartPoint[] = [];

      for (const dayKey of timeline) {
        const bcvRate = bcvSeries.get(dayKey);
        const compareRate = compareSeries.get(dayKey);

        if (bcvRate === undefined || compareRate === undefined || compareRate === 0) {
          continue;
        }

        points.push({
          x: this.dayKeyToIso(dayKey),
          y: (1 - bcvRate / compareRate) * 100,
        });
      }

      return points;
    };

    const datasets: ChartDataset[] = [
      {
        label: 'BCV USD vs Binance',
        data: discountSeries(bcvUsd, binance),
        color: this.COLORS.bcv,
      },
      {
        label: 'BCV EUR vs Binance',
        data: discountSeries(bcvEur, binance),
        color: this.COLORS.bcvEur,
      },
      {
        label: 'BCV USD vs Internal',
        data: discountSeries(bcvUsd, internal),
        color: this.COLORS.binance,
      },
      {
        label: 'BCV EUR vs Internal',
        data: discountSeries(bcvEur, internal),
        color: this.COLORS.internal,
      },
    ];

    this.logger.log(
      `Discount points: ${datasets.map((d) => `${d.label}=${d.data.length}`).join(', ')}`
    );

    return datasets;
  }

  /**
   * Last value of each Caracas day for a source, forward-filled across the
   * whole history and seeded with the last value before the cutoff date.
   */
  private buildDailySeries(
    allRates: ExchangeRate[],
    source: ExchangeRateSource,
    cutoffDate: Date
  ): Map<string, number> {
    const series = new Map<string, number>();
    const sorted = this.sortedBySource(allRates, source);

    let lastValue: number | null = null;

    for (const rate of sorted) {
      lastValue = Number(rate.value);
      series.set(this.toDayKey(rate.date), lastValue);
    }

    if (lastValue === null) {
      return series;
    }

    // Forward-fill gaps: carry the last known value into every day up to today
    const firstDate = sorted[0].date < cutoffDate ? sorted[0].date : cutoffDate;
    const timeline = this.buildTimeline(firstDate, this.daysBetween(firstDate, new Date()));

    let carried: number | undefined;

    for (const dayKey of timeline) {
      const value = series.get(dayKey);

      if (value !== undefined) {
        carried = value;
      } else if (carried !== undefined) {
        series.set(dayKey, carried);
      }
    }

    return series;
  }

  /** Ordered list of Caracas day keys from `from` up to (and including) today */
  private buildTimeline(from: Date, days: number): string[] {
    const dayKeys: string[] = [];
    const cursor = new Date(from);

    for (let i = 0; i <= days; i++) {
      dayKeys.push(this.toDayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dayKeys;
  }

  private daysBetween(from: Date, to: Date): number {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY));
  }

  /** YYYY-MM-DD in Venezuela time, so buckets match how rates are displayed */
  private toDayKey(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  }

  /** Midday Caracas (16:00 UTC), so the point lands on its own day on the axis */
  private dayKeyToIso(dayKey: string): string {
    return `${dayKey}T16:00:00.000Z`;
  }

  private sortedBySource(
    rates: ExchangeRate[],
    source: ExchangeRateSource
  ): ExchangeRate[] {
    return rates
      .filter((r) => r.source === source)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * QuickChart accepts JavaScript in the config, which plain JSON cannot express.
   * Callbacks are placed as token strings and swapped for real functions here.
   */
  private serializeChartConfig(chartConfig: unknown): string {
    return JSON.stringify(chartConfig)
      .replace(
        `"${this.POINT_LABEL_FORMATTER_TOKEN}"`,
        `function(value){return value.y.toFixed(1) + '%'}`
      );
  }

  /** Chart.js configuration shared by every chart mode */
  private buildChartConfig(params: {
    datasets: ChartDataset[];
    title: string;
    yAxisLabel: string;
    pointLabels?: boolean;
  }) {
    return {
      type: 'line',
      data: {
        datasets: params.datasets.map(({ label, data, color, markerEvery }) => ({
          label,
          data,
          borderColor: color,
          backgroundColor: color + '20',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: markerEvery
            ? data.map((_, i) => (i % markerEvery === 0 ? 5 : 0))
            : 5,
          pointHoverRadius: 7,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        // Room for the point labels, which would otherwise clip at the edges
        layout: {
          padding: {
            top: 8,
            right: 24,
          },
        },
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
          datalabels: params.pointLabels
            ? {
                display: true,
                align: 'top',
                offset: 4,
                color: this.COLORS.text,
                font: {
                  size: 11,
                  weight: 'bold',
                },
                formatter: this.POINT_LABEL_FORMATTER_TOKEN,
              }
            : { display: false },
          title: {
            display: true,
            text: params.title,
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
              unit: 'day',
              displayFormats: {
                day: 'M/d',
              },
              tooltipFormat: 'M/d/yyyy HH:mm',
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
              text: params.yAxisLabel,
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
  }
}
