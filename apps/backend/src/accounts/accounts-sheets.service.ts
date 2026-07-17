import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

@Injectable()
export class AccountsSheetsService {
  private readonly logger = new Logger(AccountsSheetsService.name);
  private readonly BINANCE_STABLECOIN_BALANCE_CELL = 'Cuentas!J4';
  private readonly BANESCO_BALANCE_VES_CELL = 'Cuentas!O26';
  private readonly WALLET_BALANCE_CELL = 'Cuentas!J5';
  private readonly CASH_BOX_BALANCE_CELL = 'Cuentas!J7';
  private readonly BOFA_CREDIT_CARD_BALANCE_CELL = 'Cuentas!K20';

  constructor(private readonly sheetsRepository: SheetsRepository) { }

  /**
   * Parses a numeric value from a formatted Google Sheets cell.
   * Handles currency symbols, thousands separators and accounting-style
   * negatives where parentheses denote a negative amount (e.g. "$ (5.22)" -> -5.22).
   */
  private parseCellNumber(rawValue: unknown): number {
    let cleanValue = String(rawValue).replace(/[$\s,]/g, '');

    let isNegative = false;
    if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
      isNegative = true;
      cleanValue = cleanValue.slice(1, -1);
    }

    const parsed = parseFloat(cleanValue);
    if (isNaN(parsed)) {
      return NaN;
    }

    return isNegative ? -parsed : parsed;
  }

  private async getCellBalance(cell: string, unit: string): Promise<number> {
    const values = await this.sheetsRepository.getSheetValues(cell);

    if (!values || values.length === 0 || !values[0] || values[0][0] == null || values[0][0] === '') {
      this.logger.warn(`No value found in ${cell}`);
      return 0;
    }

    const rawValue = values[0][0];
    const balance = this.parseCellNumber(rawValue);

    if (isNaN(balance)) {
      this.logger.warn(`Invalid balance value in ${cell}: ${rawValue}`);
      return 0;
    }

    this.logger.debug(`Balance from ${cell}: ${balance} ${unit}`);
    return balance;
  }

  async getBinanceStablecoinBalance(): Promise<number> {
    try {
      return await this.getCellBalance(this.BINANCE_STABLECOIN_BALANCE_CELL, 'USD');
    } catch (error) {
      this.logger.error(`Failed to fetch balance from sheets: ${error.message}`);
      throw error;
    }
  }

  async getBanescoBalance(): Promise<number> {
    try {
      return await this.getCellBalance(this.BANESCO_BALANCE_VES_CELL, 'Bs');
    } catch (error) {
      this.logger.error(`Failed to fetch Banesco balance: ${error.message}`);
      throw error;
    }
  }

  async getWalletBalance(): Promise<number> {
    try {
      return await this.getCellBalance(this.WALLET_BALANCE_CELL, 'USD');
    } catch (error) {
      this.logger.error(`Failed to fetch Wallet balance: ${error.message}`);
      throw error;
    }
  }

  async getCashBoxBalance(): Promise<number> {
    try {
      return await this.getCellBalance(this.CASH_BOX_BALANCE_CELL, 'USD');
    } catch (error) {
      this.logger.error(`Failed to fetch CashBox balance: ${error.message}`);
      throw error;
    }
  }

  async getBofaCreditCardBalance(): Promise<number> {
    try {
      return await this.getCellBalance(this.BOFA_CREDIT_CARD_BALANCE_CELL, 'USD');
    } catch (error) {
      this.logger.error(`Failed to fetch BofA Credit Card balance: ${error.message}`);
      throw error;
    }
  }
}
