import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

@Injectable()
export class AccountsSheetsService {
  private readonly logger = new Logger(AccountsSheetsService.name);

  constructor(private readonly sheetsRepository: SheetsRepository) { }

  async getBinanceStablecoinBalance(): Promise<number> {
    const BINANCE_STABLECOIN_BALANCE_CELL = 'Cuentas!J4';

    try {
      const values = await this.sheetsRepository.getSheetValues(BINANCE_STABLECOIN_BALANCE_CELL);

      this.logger.debug(`Raw values from ${BINANCE_STABLECOIN_BALANCE_CELL}: ${JSON.stringify(values)}`);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        this.logger.warn(`No value found in ${BINANCE_STABLECOIN_BALANCE_CELL}`);
        return 0;
      }

      const rawValue = values[0][0];
      this.logger.debug(`Raw value: "${rawValue}" (type: ${typeof rawValue})`);

      // Remove currency symbols, spaces, and commas
      const cleanValue = String(rawValue).replace(/[$\s,]/g, '');
      this.logger.debug(`Clean value: "${cleanValue}"`);

      const balance = parseFloat(cleanValue);

      if (isNaN(balance)) {
        this.logger.warn(`Invalid balance value in ${BINANCE_STABLECOIN_BALANCE_CELL}: ${rawValue}`);
        return 0;
      }

      this.logger.debug(`Parsed balance: ${balance}`);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to fetch balance from sheets: ${error.message}`);
      throw error;
    }
  }
}
