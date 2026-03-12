import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

@Injectable()
export class LedgerRowCursorService {
  private readonly logger = new Logger(LedgerRowCursorService.name);
  private readonly LEDGER_RANGE = 'Libro!B:K';
  private nextRow: number | null = null;

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  async getNextRow(): Promise<number> {
    if (this.nextRow === null) {
      const values = await this.sheetsRepository.getSheetValues(this.LEDGER_RANGE);
      this.nextRow = (values || []).length + 1;
      this.logger.log(`Ledger cursor initialized at row ${this.nextRow}`);
    }
    return this.nextRow;
  }

  advance(rowsWritten: number): void {
    if (this.nextRow !== null) {
      this.nextRow += rowsWritten;
      this.logger.log(`Ledger cursor advanced to row ${this.nextRow}`);
    }
  }
}
