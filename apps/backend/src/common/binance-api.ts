import { Injectable, Logger } from '@nestjs/common';
import { MainClient } from 'binance';

@Injectable()
export class BinanceApiClient {
  private readonly logger = new Logger(BinanceApiClient.name);
  private readonly client: MainClient;

  constructor() {
    this.client = new MainClient({
      api_key: process.env.BINANCE_API_KEY || '',
      api_secret: process.env.BINANCE_SECRET_KEY || '',
    });
  }

  getClient(): MainClient {
    return this.client;
  }

  // P2P Trades (existing functionality)
  async getC2CTradeHistory(params: any) {
    try {
      return await this.client.getC2CTradeHistory(params);
    } catch (err) {
      this.logger.error(`getC2CTradeHistory failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // Deposits (NEW)
  async getDepositHistory(params?: any) {
    try {
      return await this.client.getDepositHistory(params);
    } catch (err) {
      this.logger.error(`getDepositHistory failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // Withdrawals (NEW)
  async getWithdrawHistory(params?: any) {
    try {
      return await this.client.getWithdrawHistory(params);
    } catch (err) {
      this.logger.error(`getWithdrawHistory failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // Binance Pay (NEW - needs research if available)
  async getPayHistory(params?: any) {
    try {
      // Note: May require different endpoint or Binance Pay specific API
      // Research: https://developers.binance.com/docs/binance-pay
      return await (this.client as any).getPayHistory?.(params);
    } catch (err) {
      this.logger.error(`getPayHistory failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // Funding Wallet Balance
  async getFundingWallet(params?: { asset?: string }) {
    try {
      return await this.client.getFundingAsset(params);
    } catch (err) {
      this.logger.error(`getFundingWallet failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // Simple Earn Flexible Position
  async getSimpleEarnFlexiblePosition(params?: { asset?: string }) {
    try {
      return await this.client.getFlexibleProductPosition(params);
    } catch (err) {
      this.logger.error(
        `getSimpleEarnFlexiblePosition failed: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  // Simple Earn Locked Position
  async getSimpleEarnLockedPosition(params?: { asset?: string }) {
    try {
      return await this.client.getLockedProductPosition(params);
    } catch (err) {
      this.logger.error(
        `getSimpleEarnLockedPosition failed: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
