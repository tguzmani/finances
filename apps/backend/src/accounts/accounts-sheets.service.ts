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

  async getBinanceStablecoinBalance(): Promise<number> {
    try {
      const values = await this.sheetsRepository.getSheetValues(this.BINANCE_STABLECOIN_BALANCE_CELL);

      this.logger.debug(`Raw values from ${this.BINANCE_STABLECOIN_BALANCE_CELL}: ${JSON.stringify(values)}`);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        this.logger.warn(`No value found in ${this.BINANCE_STABLECOIN_BALANCE_CELL}`);
        return 0;
      }

      const rawValue = values[0][0];
      this.logger.debug(`Raw value: "${rawValue}" (type: ${typeof rawValue})`);

      // Remove currency symbols, spaces, and commas
      const cleanValue = String(rawValue).replace(/[$\s,]/g, '');
      this.logger.debug(`Clean value: "${cleanValue}"`);

      const balance = parseFloat(cleanValue);

      if (isNaN(balance)) {
        this.logger.warn(`Invalid balance value in ${this.BINANCE_STABLECOIN_BALANCE_CELL}: ${rawValue}`);
        return 0;
      }

      this.logger.debug(`Parsed balance: ${balance}`);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to fetch balance from sheets: ${error.message}`);
      throw error;
    }
  }

  async getBanescoBalance(): Promise<number> {
    try {
      const values = await this.sheetsRepository.getSheetValues(this.BANESCO_BALANCE_VES_CELL);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        this.logger.warn(`No value found in ${this.BANESCO_BALANCE_VES_CELL}`);
        return 0;
      }

      const rawValue = values[0][0];
      const balance = parseFloat(String(rawValue).replace(/[$\s,]/g, ''));

      if (isNaN(balance)) {
        this.logger.warn(`Invalid balance value in ${this.BANESCO_BALANCE_VES_CELL}: ${rawValue}`);
        return 0;
      }

      this.logger.debug(`Banesco balance from ${this.BANESCO_BALANCE_VES_CELL}: ${balance} Bs`);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to fetch Banesco balance: ${error.message}`);
      throw error;
    }
  }

  async getWalletBalance(): Promise<number> {
    try {
      const values = await this.sheetsRepository.getSheetValues(this.WALLET_BALANCE_CELL);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        this.logger.warn(`No value found in ${this.WALLET_BALANCE_CELL}`);
        return 0;
      }

      const rawValue = values[0][0];
      const balance = parseFloat(String(rawValue).replace(/[$\s,]/g, ''));

      if (isNaN(balance)) {
        this.logger.warn(`Invalid balance value in ${this.WALLET_BALANCE_CELL}: ${rawValue}`);
        return 0;
      }

      this.logger.debug(`Wallet balance from ${this.WALLET_BALANCE_CELL}: ${balance} USD`);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to fetch Wallet balance: ${error.message}`);
      throw error;
    }
  }

  async getCashBoxBalance(): Promise<number> {
    try {
      const values = await this.sheetsRepository.getSheetValues(this.CASH_BOX_BALANCE_CELL);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        this.logger.warn(`No value found in ${this.CASH_BOX_BALANCE_CELL}`);
        return 0;
      }

      const rawValue = values[0][0];
      const balance = parseFloat(String(rawValue).replace(/[$\s,]/g, ''));

      if (isNaN(balance)) {
        this.logger.warn(`Invalid balance value in ${this.CASH_BOX_BALANCE_CELL}: ${rawValue}`);
        return 0;
      }

      this.logger.debug(`CashBox balance from ${this.CASH_BOX_BALANCE_CELL}: ${balance} USD`);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to fetch CashBox balance: ${error.message}`);
      throw error;
    }
  }

  async getBofaCreditCardBalance(): Promise<number> {
    try {
      const values = await this.sheetsRepository.getSheetValues(this.BOFA_CREDIT_CARD_BALANCE_CELL);

      if (!values || values.length === 0 || !values[0] || !values[0][0]) {
        this.logger.warn(`No value found in ${this.BOFA_CREDIT_CARD_BALANCE_CELL}`);
        return 0;
      }

      const rawValue = values[0][0];
      const balance = parseFloat(String(rawValue).replace(/[$\s,]/g, ''));

      if (isNaN(balance)) {
        this.logger.warn(`Invalid balance value in ${this.BOFA_CREDIT_CARD_BALANCE_CELL}: ${rawValue}`);
        return 0;
      }

      this.logger.debug(`BofA Credit Card balance from ${this.BOFA_CREDIT_CARD_BALANCE_CELL}: ${balance} USD`);
      return balance;
    } catch (error) {
      this.logger.error(`Failed to fetch BofA Credit Card balance: ${error.message}`);
      throw error;
    }
  }
}
