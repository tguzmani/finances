import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

@Injectable()
export class LedgerRowService {
  private readonly logger = new Logger(LedgerRowService.name);
  private readonly LEDGER_RANGE = 'Libro!B:K';

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  async getNextRow(): Promise<number> {
    const values = await this.sheetsRepository.getSheetValues(this.LEDGER_RANGE);
    const nextRow = (values || []).length + 1;
    this.logger.log(`Ledger next row: ${nextRow}`);
    return nextRow;
  }
}
