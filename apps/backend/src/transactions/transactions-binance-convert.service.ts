import { Injectable, Logger } from '@nestjs/common';
import { BinanceApiClient } from '../common/binance-api';

export interface ConvertResult {
  fromAmount: number;
  toAmount: number;
  ratio: number;
  orderId: string;
  status: string;
}

/**
 * Turns the USDC that arrives from Codebay into USDT, which is what every other
 * flow in the app treats as the Binance currency. Both sides are stablecoins, so
 * the quote is effectively 1:1 and there is no rate to shop around for.
 */
@Injectable()
export class TransactionsBinanceConvertService {
  private readonly logger = new Logger(TransactionsBinanceConvertService.name);
  private readonly FROM_ASSET = 'USDC';
  private readonly TO_ASSET = 'USDT';
  private readonly WALLET_TYPE = 'FUNDING';

  /** Below this, Binance rejects the quote and the dust is not worth a call. */
  private readonly MIN_AMOUNT = 1;

  constructor(private readonly binanceApi: BinanceApiClient) {}

  /** USDC sitting in the funding wallet, where the Codebay payment lands. */
  async getBalance(): Promise<number> {
    const assets = await this.binanceApi.getFundingWallet({ asset: this.FROM_ASSET });

    if (!Array.isArray(assets) || assets.length === 0) return 0;

    const free = parseFloat(String(assets[0].free ?? '0'));
    return Number.isFinite(free) ? free : 0;
  }

  /**
   * Converts the given amount, or the whole funding balance when none is given.
   * Returns null when there is nothing worth converting.
   */
  async convertUsdcToUsdt(amount?: number): Promise<ConvertResult | null> {
    const fromAmount = amount ?? (await this.getBalance());

    if (fromAmount < this.MIN_AMOUNT) {
      this.logger.log(`USDC balance is ${fromAmount}, below the ${this.MIN_AMOUNT} minimum. Skipping.`);
      return null;
    }

    // Binance rejects more precision than the asset allows
    const rounded = Math.floor(fromAmount * 1e6) / 1e6;

    this.logger.log(`Requesting quote to convert ${rounded} ${this.FROM_ASSET} to ${this.TO_ASSET}`);

    const quote = await this.binanceApi.getConvertQuote({
      fromAsset: this.FROM_ASSET,
      toAsset: this.TO_ASSET,
      fromAmount: rounded,
      walletType: this.WALLET_TYPE,
    });

    if (!quote?.quoteId) {
      throw new Error(`Binance returned no quote for ${rounded} ${this.FROM_ASSET}`);
    }

    this.logger.log(
      `Quote ${quote.quoteId}: ${rounded} ${this.FROM_ASSET} -> ${quote.toAmount} ${this.TO_ASSET} (ratio ${quote.ratio})`,
    );

    const accepted = await this.binanceApi.acceptConvertQuote({ quoteId: quote.quoteId });

    const result: ConvertResult = {
      fromAmount: rounded,
      toAmount: Number(quote.toAmount),
      ratio: Number(quote.ratio),
      orderId: String(accepted?.orderId ?? ''),
      status: String(accepted?.orderStatus ?? 'UNKNOWN'),
    };

    this.logger.log(
      `Converted ${result.fromAmount} ${this.FROM_ASSET} to ${result.toAmount} ${this.TO_ASSET} (order ${result.orderId}, ${result.status})`,
    );

    return result;
  }
}
