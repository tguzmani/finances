import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

@Injectable()
export class ExchangesSheetsService {
  private readonly logger = new Logger(ExchangesSheetsService.name);
  private readonly BS_DOLLAR_RATE_CELL = 'Libro!D2';

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  async getBsDollarRate(): Promise<number> {
    try {
      const values = await this.sheetsRepository.getSheetValues(this.BS_DOLLAR_RATE_CELL);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        throw new Error('Failed to fetch Bs/$ rate from Sheets.');
      }

      const rawValue = values[0][0];
      const rate = parseFloat(String(rawValue).replace(/,/g, ''));

      if (isNaN(rate) || rate <= 0) {
        throw new Error(`Invalid Bs/$ rate value: ${rawValue}`);
      }

      this.logger.debug(`Bs/$ rate from ${this.BS_DOLLAR_RATE_CELL}: ${rate}`);
      return rate;
    } catch (error) {
      this.logger.error(`Failed to fetch Bs/$ rate: ${error.message}`);
      throw error;
    }
  }

  async updateBsDollarRate(rate: number): Promise<void> {
    try {
      await this.sheetsRepository.updateSheetValues(this.BS_DOLLAR_RATE_CELL, [[rate]]);
      this.logger.log(`Updated Bs/$ rate in Sheets (${this.BS_DOLLAR_RATE_CELL}): ${rate}`);
    } catch (error) {
      this.logger.error(`Failed to update Bs/$ rate in Sheets: ${error.message}`);
      throw error;
    }
  }
}
