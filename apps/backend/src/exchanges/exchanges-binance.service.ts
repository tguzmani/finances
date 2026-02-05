import { Injectable, Logger } from '@nestjs/common';
import { BinanceApiClient } from '../common/binance-api';
import { BinanceP2PTrade } from './interfaces/binance-p2p.interface';
import { TradeType } from './exchange.types';

@Injectable()
export class ExchangesBinanceService {
  private readonly logger = new Logger(ExchangesBinanceService.name);

  constructor(private readonly binanceApi: BinanceApiClient) {}

  async getP2PHistory(
    tradeType: TradeType = TradeType.SELL,
    limit = 30
  ): Promise<BinanceP2PTrade[]> {
    try {
      this.logger.log(
        `Fetching P2P trade history: tradeType=${tradeType}, limit=${limit}`
      );

      const response = await this.binanceApi.getC2CTradeHistory({
        tradeType: tradeType,
      });

      if (!response || !response.data) {
        this.logger.warn('No data returned from Binance API');
        return [];
      }

      // Sort by createTime descending (most recent first) and limit
      const trades = response.data
        .sort((a: any, b: any) => b.createTime - a.createTime)
        .slice(0, limit);

      this.logger.log(`Fetched ${trades.length} trades from Binance`);

      return trades;
    } catch (err) {
      this.logger.error(
        `Failed to fetch P2P history: ${(err as Error).message}`
      );
      throw err;
    }
  }
}
