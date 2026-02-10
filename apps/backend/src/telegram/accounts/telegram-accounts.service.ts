import { Injectable, Logger } from '@nestjs/common';
import { BinanceAccountService } from '../../accounts/accounts-binance.service';
import { AccountsSheetsService } from '../../accounts/accounts-sheets.service';
import { TelegramAccountsPresenter } from './telegram-accounts.presenter';

@Injectable()
export class TelegramAccountsService {
  private readonly logger = new Logger(TelegramAccountsService.name);

  constructor(
    private readonly binanceAccountService: BinanceAccountService,
    private readonly accountsSheetsService: AccountsSheetsService,
    private readonly presenter: TelegramAccountsPresenter,
  ) {}

  async getStablecoinBalanceMessage(): Promise<string> {
    try {
      const overview = await this.binanceAccountService.getStablecoinOverview();
      const sheetsBalance = await this.accountsSheetsService.getBinanceStablecoinBalance();
      return this.presenter.formatStablecoinOverview(overview, sheetsBalance);
    } catch (error) {
      this.logger.error(`Failed to get stablecoin balance: ${error.message}`);
      throw error;
    }
  }
}
