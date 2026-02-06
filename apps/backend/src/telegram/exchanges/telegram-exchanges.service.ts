import { Injectable, Logger } from '@nestjs/common';
import { ExchangesService } from '../../exchanges/exchanges.service';
import { TelegramExchangesPresenter } from './telegram-exchanges.presenter';
import { ExchangeStatus, Exchange } from '@prisma/client';

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

  async getRecentExchangesList(showAll = false): Promise<string> {
    try {
      const allExchanges = await this.exchangesService.findAll({});

      // Filter out rejected by default
      const exchanges = showAll
        ? allExchanges
        : allExchanges.filter(e => e.status !== ExchangeStatus.REJECTED);

      return this.presenter.formatRecentList(exchanges);
    } catch (error) {
      this.logger.error(`Failed to get exchanges list: ${error.message}`);
      throw new Error('Error getting exchanges');
    }
  }

  formatExchangeForReview(exchange: Exchange): string {
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

  async updateExchangeRateOnly(wavg: number): Promise<{updated: boolean, value: number}> {
    return this.exchangesService.updateExchangeRateOnly(wavg);
  }

  formatExchangeRateUpdated(value: number): string {
    return this.presenter.formatExchangeRateUpdated(value);
  }

  formatExchangeRateUnchanged(value: number): string {
    return this.presenter.formatExchangeRateUnchanged(value);
  }
}
