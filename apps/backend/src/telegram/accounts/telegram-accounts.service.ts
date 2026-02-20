import { Injectable, Logger } from '@nestjs/common';
import { BinanceAccountService } from '../../accounts/accounts-binance.service';
import { AccountsSheetsService } from '../../accounts/accounts-sheets.service';
import { BanescoAccountService } from '../../accounts/accounts-banesco.service';
import { CashAccountService } from '../../accounts/accounts-cash.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { ExchangesBcvService } from '../../exchanges/exchanges-bcv.service';
import { TelegramAccountsPresenter } from './telegram-accounts.presenter';

@Injectable()
export class TelegramAccountsService {
  private readonly logger = new Logger(TelegramAccountsService.name);

  constructor(
    private readonly binanceAccountService: BinanceAccountService,
    private readonly accountsSheetsService: AccountsSheetsService,
    private readonly banescoAccountService: BanescoAccountService,
    private readonly cashAccountService: CashAccountService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly bcvService: ExchangesBcvService,
    private readonly presenter: TelegramAccountsPresenter,
  ) {}

  async getAllBalancesMessage(): Promise<string> {
    try {
      const [banesco, stablecoinOverview, sheetsBalance, wallet, cashBox, bofaCreditCard, latestRate, bcvUsd, bcvEur] = await Promise.all([
        this.banescoAccountService.getBanescoStatus(),
        this.binanceAccountService.getStablecoinOverview(),
        this.accountsSheetsService.getBinanceStablecoinBalance(),
        this.cashAccountService.getWalletStatus(),
        this.cashAccountService.getCashBoxStatus(),
        this.cashAccountService.getBofaCreditCardStatus(),
        this.exchangeRateService.findLatest(),
        this.bcvService.getUsdExchangeRate(),
        this.bcvService.getEurExchangeRate(),
      ]);

      const exchangeRate = latestRate ? Number(latestRate.value) : null;

      return this.presenter.formatAllBalances(
        banesco,
        { overview: stablecoinOverview, sheetsBalance },
        wallet,
        cashBox,
        bofaCreditCard,
        exchangeRate,
        { bcvUsd, bcvEur },
      );
    } catch (error) {
      this.logger.error(`Failed to get all balances: ${error.message}`);
      throw error;
    }
  }

  async adjustBanescoBalance(newBalance: number): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.banescoAccountService.adjustBanescoBalance(newBalance);
      const message = this.presenter.formatBalanceAdjustment(result);
      return { success: true, message };
    } catch (error) {
      this.logger.error(`Failed to adjust Banesco balance: ${error.message}`);
      throw error;
    }
  }
}
