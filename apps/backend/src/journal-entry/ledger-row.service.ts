import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';
import { fold } from './keyword-match';

@Injectable()
export class LedgerRowService {
  private readonly logger = new Logger(LedgerRowService.name);
  private readonly LEDGER_RANGE = 'Libro!B:K';

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  /**
   * Row of the ledger block carrying this description, by the text in column C.
   *
   * Template rows move between monthly sheets — EVO25 sat on row 44 in August
   * and row 40 in October — so anything writing into the template has to find
   * its row rather than remember a number.
   *
   * The first match wins: the template sits above the entries the bot appends,
   * so a later entry repeating the text cannot steal the target.
   */
  async findRowByDescription(sheet: string, description: string): Promise<number | null> {
    const values = await this.sheetsRepository.getSheetValues(`${sheet}!C1:C60`);
    if (!values) return null;

    const wanted = fold(description);
    const index = values.findIndex((cells) => fold(String(cells?.[0] ?? '')) === wanted);

    return index === -1 ? null : index + 1;
  }

  async getNextRow(): Promise<number> {
    const values = await this.sheetsRepository.getSheetValues(this.LEDGER_RANGE);
    const nextRow = (values || []).length + 1;
    this.logger.log(`Ledger next row: ${nextRow}`);
    return nextRow;
  }
}
