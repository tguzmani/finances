import { Injectable, Logger } from '@nestjs/common';
import { ExchangesService } from '../../exchanges/exchanges.service';
import { TelegramExchangesPresenter } from './telegram-exchanges.presenter';
import { ExchangeStatus } from '@prisma/client';

@Injectable()
export class TelegramExchangesService {
  private readonly logger = new Logger(TelegramExchangesService.name);

  constructor(
    private readonly exchangesService: ExchangesService,
    private readonly presenter: TelegramExchangesPresenter,
  ) {}

  async getRecentExchangesList(showAll = false): Promise<string> {
    try {
      const allExchanges = await this.exchangesService.findAll({});

      // Filter out rejected and registered by default
      const exchanges = showAll
        ? allExchanges
        : allExchanges.filter(e =>
            e.status !== ExchangeStatus.REJECTED &&
            e.status !== ExchangeStatus.REGISTERED
          );

      return this.presenter.formatRecentList(exchanges);
    } catch (error) {
      this.logger.error(`Failed to get exchanges list: ${error.message}`);
      throw new Error('Error getting exchanges');
    }
  }

  async getReviewedExchanges() {
    return this.exchangesService.findByStatus(ExchangeStatus.REVIEWED);
  }
}
