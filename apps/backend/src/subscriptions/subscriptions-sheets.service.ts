import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

export interface SubscriptionRow {
  /** 1-based row in the Suscripciones sheet. */
  row: number;
  name: string;
  /** Day of the month the charge is expected. */
  day: number | null;
  active: boolean;
  /** What the charge is expected to be, in USD. */
  cost: number | null;
  method: string;
  frequency: string;
  /** Month an annual subscription charges in. Empty for monthly ones. */
  month: number | null;
  /** What actually landed this month, in USD. Empty until the charge arrives. */
  charged: number | null;
  chargedOn: string;
}

const SHEET = 'Suscripciones';
/** The table starts under its header, which sits on row 2. */
const FIRST_DATA_ROW = 3;
const LAST_DATA_ROW = 20;
const COLUMNS = `${SHEET}!B${FIRST_DATA_ROW}:J${LAST_DATA_ROW}`;

@Injectable()
export class SubscriptionsSheetsService {
  private readonly logger = new Logger(SubscriptionsSheetsService.name);

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  /**
   * The subscription catalog: one row per service ever subscribed to, whether
   * it is running or not. Rows are never removed — a cancelled service keeps
   * its row with `active` false, so resubscribing is a flag away.
   */
  async getCatalog(): Promise<SubscriptionRow[]> {
    const values = await this.sheetsRepository.getSheetValues(COLUMNS);
    if (!values) return [];

    return values
      .map((cells, index) => this.toRow(cells, FIRST_DATA_ROW + index))
      .filter((row): row is SubscriptionRow => row !== null);
  }

  /**
   * Records what a subscription actually charged this month. The Libro's
   * subscription line sums this column, so writing here is what moves it.
   */
  async recordCharge(row: number, amount: number, date: Date): Promise<void> {
    const range = `${SHEET}!I${row}:J${row}`;
    await this.sheetsRepository.updateSheetValues(range, [
      [amount, this.formatDate(date)],
    ]);
    this.logger.log(`Recorded ${amount} USD on ${SHEET} row ${row}`);
  }

  /**
   * Adds a service the catalog did not have, already marked as charged.
   *
   * It goes in active, since a charge that just arrived is most likely
   * recurring. A one-off purchase shows itself next month by not charging
   * again, and gets switched off then.
   */
  async addSubscription(params: {
    name: string;
    amount: number;
    date: Date;
    method: string;
  }): Promise<number | null> {
    const catalog = await this.getCatalog();
    const row = FIRST_DATA_ROW + catalog.length;

    if (row > LAST_DATA_ROW) {
      this.logger.error(`Subscription table is full (row ${row} past ${LAST_DATA_ROW})`);
      return null;
    }

    const range = `${SHEET}!B${row}:J${row}`;
    await this.sheetsRepository.updateSheetValues(range, [[
      params.name,
      params.date.getDate(),
      true,
      params.amount,
      params.method,
      'Mensual',
      '',
      params.amount,
      this.formatDate(params.date),
    ]]);

    this.logger.log(`Added "${params.name}" to ${SHEET} at row ${row}`);
    return row;
  }

  /**
   * Empties what was charged, leaving the catalog itself alone.
   *
   * Each month is its own spreadsheet, copied from the last, so these two
   * columns arrive carrying the previous month's charges. Left behind, the
   * Libro's subscription line would start the month already full.
   */
  async clearMonthlyCharges(): Promise<void> {
    const blanks = Array.from(
      { length: LAST_DATA_ROW - FIRST_DATA_ROW + 1 },
      () => ['', ''],
    );
    await this.sheetsRepository.updateSheetValues(
      `${SHEET}!I${FIRST_DATA_ROW}:J${LAST_DATA_ROW}`,
      blanks,
    );
    this.logger.log(`Cleared charged amounts on ${SHEET}`);
  }

  private toRow(cells: any[], row: number): SubscriptionRow | null {
    const name = String(cells[0] ?? '').trim();
    if (!name) return null;

    return {
      row,
      name,
      day: this.toNumber(cells[1]),
      active: String(cells[2] ?? '').trim().toUpperCase() === 'TRUE',
      cost: this.toNumber(cells[3]),
      method: String(cells[4] ?? '').trim(),
      frequency: String(cells[5] ?? '').trim(),
      month: this.toNumber(cells[6]),
      charged: this.toNumber(cells[7]),
      chargedOn: String(cells[8] ?? '').trim(),
    };
  }

  private toNumber(value: unknown): number | null {
    const clean = String(value ?? '').replace(/[$\s,]/g, '');
    if (!clean) return null;
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  }

  /** Same "1-Sep" shape the Libro uses. */
  private formatDate(date: Date): string {
    const day = date.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Caracas' });
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Caracas' });
    return `${day}-${month}`;
  }
}
