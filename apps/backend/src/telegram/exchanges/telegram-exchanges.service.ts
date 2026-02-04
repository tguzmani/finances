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

  async getNextForReview() {
    return this.exchangesService.getNextPendingReview();
  }

  async getPendingReviewCount(): Promise<number> {
    return this.exchangesService.countByStatus([
      ExchangeStatus.COMPLETED,
      ExchangeStatus.PENDING,
    ]);
  }

  async getRecentExchangesList(): Promise<string> {
    try {
      const exchanges = await this.exchangesService.findAll({});
      return this.presenter.formatRecentList(exchanges);
    } catch (error) {
      this.logger.error(`Failed to get exchanges list: ${error.message}`);
      throw new Error('Error getting exchanges');
    }
  }

  formatExchangeForReview(exchange: any): string {
    return this.presenter.formatForReview(exchange);
  }

  // Register flow methods
  async getReviewedExchanges() {
    return this.exchangesService.findByStatus(ExchangeStatus.REVIEWED);
  }

  calculateRegisterMetrics(exchanges: any[]) {
    return this.exchangesService.calculateRegisterMetrics(exchanges);
  }

  formatRegisterSummary(metrics: any): string {
    return this.presenter.formatRegisterSummary(metrics);
  }

  async registerExchanges(exchangeIds: number[], wavg: number): Promise<void> {
    return this.exchangesService.registerExchanges(exchangeIds, wavg);
  }
}
