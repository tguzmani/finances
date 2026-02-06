import { Injectable, Logger } from '@nestjs/common';
import { ExchangeRatesAggregatorService } from '../../exchanges/exchange-rates-aggregator.service';
import { TelegramRatesPresenter } from './telegram-rates.presenter';

@Injectable()
export class TelegramRatesService {
  private readonly logger = new Logger(TelegramRatesService.name);

  constructor(
    private readonly ratesAggregator: ExchangeRatesAggregatorService,
    private readonly presenter: TelegramRatesPresenter,
  ) {}

  /**
   * Get formatted rates message for Telegram
   */
  async getRatesMessage(): Promise<string> {
    try {
      this.logger.log('Getting rates message for Telegram...');

      const ratesWithDiscounts = await this.ratesAggregator.getRatesWithDiscounts();

      return this.presenter.formatRatesWithDiscounts(ratesWithDiscounts);
    } catch (error) {
      this.logger.error(`Error getting rates message: ${error.message}`);
      throw error;
    }
  }
}
