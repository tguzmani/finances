import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

export interface DcaPurchase {
  date: Date;
  asset: string;
  amount: number;
  tokens: number;
}

/**
 * Reads and writes the per-asset summary table of the "DCA Cripto" sheet, whose
 * rows start right below the header at row 9: column H holds the asset, column M
 * the current price and column N the current value (a formula over M).
 */
@Injectable()
export class DcaSheetsService {
  private readonly logger = new Logger(DcaSheetsService.name);
  private readonly SHEET = 'DCA Cripto';
  private readonly FIRST_ROW = 10;
  private readonly LAST_ROW = 40;
  private readonly LOG_LAST_ROW = 300;

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  /**
   * Every DCA purchase, from the log on the left of the sheet: date, asset,
   * amount paid and tokens received.
   */
  async getPurchases(): Promise<DcaPurchase[]> {
    const values = await this.sheetsRepository.getSheetValues(
      `${this.SHEET}!B5:F${this.LOG_LAST_ROW}`,
      'UNFORMATTED_VALUE',
    );

    const purchases: DcaPurchase[] = [];

    for (const row of values || []) {
      const [serialDate, asset, amount, , tokens] = row ?? [];
      if (!asset || !serialDate) continue;

      purchases.push({
        date: this.serialToDate(Number(serialDate)),
        asset: String(asset).trim().toUpperCase(),
        amount: Number(amount) || 0,
        tokens: Number(tokens) || 0,
      });
    }

    return purchases;
  }

  /** Sheets stores dates as days since 1899-12-30. */
  private serialToDate(serial: number): Date {
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  }

  /** Assets listed in the summary table, in sheet order. */
  async getAssets(): Promise<string[]> {
    const values = await this.sheetsRepository.getSheetValues(
      `${this.SHEET}!H${this.FIRST_ROW}:H${this.LAST_ROW}`,
    );
    const assets: string[] = [];

    for (const row of values || []) {
      const asset = String(row?.[0] ?? '').trim();
      // The table ends at the first blank row
      if (!asset) break;
      assets.push(asset.toUpperCase());
    }

    return assets;
  }

  /**
   * Write the current price of each asset into column M, in the same order
   * getAssets() returned them. Assets without a price keep whatever the cell
   * already had, so a partial outage never blanks the table.
   */
  async writePrices(assets: string[], prices: Map<string, number>): Promise<number> {
    const existing = await this.sheetsRepository.getSheetValues(
      `${this.SHEET}!M${this.FIRST_ROW}:M${this.FIRST_ROW + assets.length - 1}`,
      'UNFORMATTED_VALUE',
    );

    let written = 0;
    const values = assets.map((asset, index) => {
      const price = prices.get(asset);
      if (price === undefined) {
        return [existing?.[index]?.[0] ?? ''];
      }
      written++;
      return [price];
    });

    await this.sheetsRepository.updateSheetValues(
      `${this.SHEET}!M${this.FIRST_ROW}:M${this.FIRST_ROW + assets.length - 1}`,
      values,
    );

    this.logger.log(`Wrote ${written}/${assets.length} prices to ${this.SHEET} column M`);
    return written;
  }
}
