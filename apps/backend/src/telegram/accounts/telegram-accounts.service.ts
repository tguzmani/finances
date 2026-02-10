import { Injectable, Logger } from '@nestjs/common';
import { BinanceAccountService } from '../../accounts/binance-account.service';
import { TelegramAccountsPresenter } from './telegram-accounts.presenter';

@Injectable()
export class TelegramAccountsService {
  private readonly logger = new Logger(TelegramAccountsService.name);

  constructor(
    private readonly binanceAccountService: BinanceAccountService,
    private readonly presenter: TelegramAccountsPresenter,
  ) {}

  async getStablecoinBalanceMessage(): Promise<string> {
    try {
      const overview = await this.binanceAccountService.getStablecoinOverview();
      return this.presenter.formatStablecoinOverview(overview);
    } catch (error) {
      this.logger.error(`Failed to get stablecoin balance: ${error.message}`);
      throw error;
    }
  }
}
