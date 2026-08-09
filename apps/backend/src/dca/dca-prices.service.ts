import { Injectable, Logger } from '@nestjs/common';
import { BinanceApiClient } from '../common/binance-api';
import { DcaSheetsService } from './dca-sheets.service';

export interface DcaPriceRefreshResult {
  assets: number;
  written: number;
  missing: string[];
}

/**
 * Keeps the "Precio Actual" column of the DCA sheet fed from Binance. The sheet
 * used to call a getCryptoPrice() Apps Script that failed silently for some
 * assets, which turned the whole "Valor actual" total into #VALUE!.
 */
@Injectable()
export class DcaPricesService {
  private readonly logger = new Logger(DcaPricesService.name);
  private readonly QUOTE_ASSET = 'USDT';

  constructor(
    private readonly binanceApi: BinanceApiClient,
    private readonly dcaSheets: DcaSheetsService,
  ) {}

  private toSymbol(asset: string): string {
    return `${asset}${this.QUOTE_ASSET}`;
  }

  async refreshPrices(): Promise<DcaPriceRefreshResult> {
    const assets = await this.dcaSheets.getAssets();

    if (assets.length === 0) {
      this.logger.warn('No assets found in the DCA sheet, nothing to refresh');
      return { assets: 0, written: 0, missing: [] };
    }

    const prices = await this.getCurrentPrices(assets);
    const written = await this.dcaSheets.writePrices(assets, prices);
    const missing = assets.filter((asset) => !prices.has(asset));

    if (missing.length > 0) {
      this.logger.warn(`No Binance price for: ${missing.join(', ')}`);
    }

    return { assets: assets.length, written, missing };
  }

  /** Current spot price per asset, in a single request. */
  async getCurrentPrices(assets: string[]): Promise<Map<string, number>> {
    const symbols = assets.map((asset) => this.toSymbol(asset));
    const prices = new Map<string, number>();

    const response = await this.binanceApi.getSymbolPriceTicker({ symbols });
    const tickers = Array.isArray(response) ? response : [response];

    for (const asset of assets) {
      const ticker = tickers.find((t) => t?.symbol === this.toSymbol(asset));
      const price = ticker ? Number(ticker.price) : NaN;

      if (Number.isFinite(price) && price > 0) {
        prices.set(asset, price);
      }
    }

    return prices;
  }

  /**
   * Price an asset had at the start of every hour in the range, keyed by the
   * hour in ISO form (YYYY-MM-DDTHH). Used to value past holdings at the exact
   * moment an equity snapshot was captured.
   */
  async getHourlyPrices(asset: string, from: Date, to: Date): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const HOUR = 3600_000;
    let startTime = from.getTime();

    // Binance caps a response at 1000 candles, so walk the range page by page
    while (startTime <= to.getTime()) {
      const klines = await this.binanceApi.getKlines({
        symbol: this.toSymbol(asset),
        interval: '1h',
        startTime,
        endTime: to.getTime(),
        limit: 1000,
      });

      if (klines.length === 0) break;

      for (const kline of klines) {
        const [openTime, open] = kline;
        const hour = new Date(Number(openTime)).toISOString().slice(0, 13);
        const price = Number(open);

        if (Number.isFinite(price) && price > 0) {
          prices.set(hour, price);
        }
      }

      startTime = Number(klines[klines.length - 1][0]) + HOUR;
    }

    return prices;
  }
}
