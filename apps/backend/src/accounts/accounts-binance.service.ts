import { Injectable, Logger } from '@nestjs/common';
import { BinanceApiClient } from '../common/binance-api';
import {
  AssetBalance,
  StablecoinOverview,
} from './interfaces/binance-account.interface';

@Injectable()
export class BinanceAccountService {
  private readonly logger = new Logger(BinanceAccountService.name);

  constructor(private readonly binanceApi: BinanceApiClient) {}

  private safeFloat(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  async getAssetOverview(asset: string): Promise<AssetBalance> {
    let totalFunding = 0;
    let totalEarn = 0;

    // 1. Funding Wallet
    try {
      const fundingRes = await this.binanceApi.getFundingWallet({ asset });
      if (fundingRes && Array.isArray(fundingRes) && fundingRes.length > 0) {
        const assetData = fundingRes[0];
        totalFunding =
          this.safeFloat(assetData.free) + this.safeFloat(assetData.locked);
      }
    } catch (err) {
      this.logger.warn(`Funding wallet query failed for ${asset}: ${err}`);
    }

    // 2. Simple Earn Flexible
    try {
      const flexRes = await this.binanceApi.getSimpleEarnFlexiblePosition({
        asset,
      });
      if (flexRes && flexRes.rows && Array.isArray(flexRes.rows)) {
        for (const pos of flexRes.rows) {
          totalEarn += this.safeFloat(pos.totalAmount);
        }
      }
    } catch (err) {
      this.logger.warn(`Flexible earn query failed for ${asset}: ${err}`);
    }

    // 3. Simple Earn Locked
    try {
      const lockedRes = await this.binanceApi.getSimpleEarnLockedPosition({
        asset,
      });
      if (lockedRes && lockedRes.rows && Array.isArray(lockedRes.rows)) {
        for (const pos of lockedRes.rows) {
          totalEarn += this.safeFloat(pos.amount);
        }
      }
    } catch (err) {
      this.logger.warn(`Locked earn query failed for ${asset}: ${err}`);
    }

    return {
      asset,
      totalBalance: Math.round((totalFunding + totalEarn) * 10000) / 10000,
      breakdown: {
        funding: Math.round(totalFunding * 10000) / 10000,
        earn: Math.round(totalEarn * 10000) / 10000,
      },
    };
  }

  async getStablecoinOverview(): Promise<StablecoinOverview> {
    const stablecoins = ['USDT', 'USDC'];
    const assets: AssetBalance[] = [];

    for (const coin of stablecoins) {
      const balance = await this.getAssetOverview(coin);
      assets.push(balance);
    }

    const totalBalance = assets.reduce((sum, a) => sum + a.totalBalance, 0);

    return {
      assets,
      totalBalance: Math.round(totalBalance * 10000) / 10000,
    };
  }
}
