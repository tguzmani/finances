import { Injectable, Logger } from '@nestjs/common';
import { ACCOUNTING_NUMBER_FORMAT, SheetsRepository } from '../common/sheets.repository';

/** Columns holding the Debe and Haber amounts in the Libro ledger. */
const AMOUNT_COLUMNS = { first: 'F', last: 'G' };

@Injectable()
export class LedgerWriterService {
  private readonly logger = new Logger(LedgerWriterService.name);

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  /**
   * Writes ledger rows and restores the accounting format on their amount cells.
   *
   * The Libro template carries the format down to a fixed row only, so entries
   * appended past it land in unformatted cells and show raw decimals until
   * someone formats them by hand. Reapplying it on every write keeps appended
   * rows looking like the rest of the ledger.
   *
   * A formatting failure never fails the write: the entry is already in the
   * sheet and correct, it just looks wrong.
   */
  async writeEntry(range: string, rows: any[][]): Promise<void> {
    await this.sheetsRepository.updateSheetValues(range, rows);

    try {
      await this.sheetsRepository.applyNumberFormat(
        this.amountRangeFor(range),
        ACCOUNTING_NUMBER_FORMAT,
      );
    } catch (error) {
      this.logger.warn(
        `Wrote ${range} but could not apply the accounting format: ${error.message}`,
      );
    }
  }

  /** "Libro!B120:K121" -> "Libro!F120:G121". */
  private amountRangeFor(range: string): string {
    const match = range.match(/^(.+!)[A-Z]+(\d+):[A-Z]+(\d+)$/);
    if (!match) {
      throw new Error(`Unsupported ledger range: "${range}"`);
    }

    const [, sheetPrefix, startRow, endRow] = match;
    return `${sheetPrefix}${AMOUNT_COLUMNS.first}${startRow}:${AMOUNT_COLUMNS.last}${endRow}`;
  }
}
