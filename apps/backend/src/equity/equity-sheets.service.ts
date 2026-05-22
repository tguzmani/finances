import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

@Injectable()
export class EquitySheetsService {
  private readonly logger = new Logger(EquitySheetsService.name);
  private readonly EQUITY_VALUE_CELL = 'Cuentas!K3';
  private readonly BINANCE_ALLOCATED_CELL = 'DCA Cripto!T4';
  private readonly BINANCE_CURRENT_CELL = 'DCA Cripto!T5';
  private readonly SHEETS_EVO25_CELL = 'Cuentas!J11';

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  async getEquityValue(): Promise<number> {
    return this.readCellAsNumber(this.EQUITY_VALUE_CELL);
  }

  async getBinancePnl(): Promise<number> {
    const [allocated, current] = await Promise.all([
      this.readCellAsNumber(this.BINANCE_ALLOCATED_CELL),
      this.readCellAsNumber(this.BINANCE_CURRENT_CELL),
    ]);
    return current - allocated;
  }

  async getSheetsEvo25Value(): Promise<number> {
    return this.readCellAsNumber(this.SHEETS_EVO25_CELL);
  }

  private async readCellAsNumber(cell: string): Promise<number> {
    try {
      const values = await this.sheetsRepository.getSheetValues(cell);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        this.logger.warn(`No value found in ${cell}`);
        return 0;
      }

      const rawValue = values[0][0];
      const cleanValue = String(rawValue).replace(/[$\s,]/g, '');
      const parsed = parseFloat(cleanValue);

      if (isNaN(parsed)) {
        this.logger.warn(`Invalid value in ${cell}: ${rawValue}`);
        return 0;
      }

      this.logger.debug(`${cell}: ${parsed}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Failed to read ${cell}: ${error.message}`);
      throw error;
    }
  }
}
