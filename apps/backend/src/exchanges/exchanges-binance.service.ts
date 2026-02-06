import { Injectable, Logger } from '@nestjs/common';
import { BinanceApiClient } from '../common/binance-api';
import { BinanceP2PTrade, BinanceP2POffersResponse } from './interfaces/binance-p2p.interface';
import { TradeType } from './exchange.types';
import axios from 'axios';

@Injectable()
export class ExchangesBinanceService {
  private readonly logger = new Logger(ExchangesBinanceService.name);
  private readonly P2P_API_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

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

  /**
   * Get current P2P market offers for a given fiat/asset pair
   * @param fiat Fiat currency (e.g., 'VES', 'USD')
   * @param asset Crypto asset (e.g., 'USDT', 'BTC')
   * @param tradeType 'BUY' or 'SELL' from the user's perspective
   * @param limit Number of offers to fetch (max 20 per page)
   * @param transAmount Optional transaction amount to filter offers (e.g., 100 USDT)
   */
  async getP2POffers(
    fiat: string,
    asset: string,
    tradeType: 'BUY' | 'SELL' = 'SELL',
    limit = 10,
    transAmount?: number
  ): Promise<BinanceP2POffersResponse> {
    try {
      this.logger.log(
        `Fetching P2P offers: fiat=${fiat}, asset=${asset}, tradeType=${tradeType}, limit=${limit}, transAmount=${transAmount || 'not specified'}`
      );

      const requestBody: any = {
        fiat,
        page: 1,
        rows: Math.min(limit, 20), // API limit is 20 per page
        tradeType,
        asset,
        countries: [],
        payTypes: [],
        publisherType: null,
      };

      // Add transAmount if specified (filters offers by transaction amount)
      if (transAmount) {
        requestBody.transAmount = transAmount;
      }

      const response = await axios.post<BinanceP2POffersResponse>(
        this.P2P_API_URL,
        requestBody
      );

      if (!response.data || !response.data.success) {
        this.logger.warn('Failed to fetch P2P offers from Binance');
        return {
          code: response.data?.code || 'ERROR',
          message: response.data?.message || 'Unknown error',
          data: [],
          total: 0,
          success: false,
        };
      }

      this.logger.log(`✅ Fetched ${response.data.data.length} P2P offers from Binance`);

      if (response.data.data.length === 0) {
        this.logger.warn(`⚠️ No offers found for ${fiat}/${asset} with tradeType=${tradeType}, transAmount=${transAmount}`);
        return response.data;
      }

      // Log detailed offer information
      this.logger.log('=== Binance P2P Offers ===');
      response.data.data.forEach((offer, index) => {
        this.logger.log(
          `Offer ${index + 1}: Price=${offer.adv.price} ${fiat}/${asset}, ` +
          `Quantity=${offer.adv.tradableQuantity}, ` +
          `Min=${offer.adv.minSingleTransAmount}, ` +
          `Max=${offer.adv.maxSingleTransAmount}, ` +
          `Advertiser=${offer.advertiser.nickName}`
        );
      });

      // Log prices array for easy viewing
      const prices = response.data.data.map(offer => parseFloat(offer.adv.price));
      this.logger.log(`📊 Prices array: [${prices.join(', ')}]`);
      this.logger.log(`📈 Min price: ${Math.min(...prices)}, Max price: ${Math.max(...prices)}`);

      return response.data;
    } catch (err) {
      this.logger.error(
        `Failed to fetch P2P offers: ${(err as Error).message}`
      );
      throw err;
    }
  }

  /**
   * Get average P2P exchange rate from top offers
   * @param fiat Fiat currency (e.g., 'VES')
   * @param asset Crypto asset (e.g., 'USDT')
   * @param tradeType 'BUY' or 'SELL' from the user's perspective
   * @param limit Number of top offers to average (default 10)
   * @param transAmount Optional transaction amount to filter offers (e.g., 100 USDT)
   */
  async getAverageP2PRate(
    fiat: string,
    asset: string,
    tradeType: 'BUY' | 'SELL' = 'SELL',
    limit = 10,
    transAmount?: number
  ): Promise<number | null> {
    try {
      const offersResponse = await this.getP2POffers(fiat, asset, tradeType, limit, transAmount);

      if (!offersResponse.success || offersResponse.data.length === 0) {
        this.logger.warn('No P2P offers available to calculate average');
        return null;
      }

      const offers = offersResponse.data;
      const prices = offers.map(offer => parseFloat(offer.adv.price));

      const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;

      this.logger.log(
        `Average P2P rate for ${fiat}/${asset} (${tradeType}, amount=${transAmount || 'any'}): ` +
        `${average.toFixed(2)} (from ${prices.length} offers)`
      );

      return average;
    } catch (err) {
      this.logger.error(
        `Failed to calculate average P2P rate: ${(err as Error).message}`
      );
      return null;
    }
  }
}
