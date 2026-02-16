import { Injectable, Logger } from '@nestjs/common';
import { BinanceAccountService } from '../../accounts/accounts-binance.service';
import { AccountsSheetsService } from '../../accounts/accounts-sheets.service';
import { TelegramAccountsPresenter } from './telegram-accounts.presenter';
import { ExchangesSheetsService } from '../../exchanges/exchanges-sheets.service';
import { TransactionsSheetsService } from '../../transactions/transactions-sheets.service';
import { TransactionData } from '../../transactions/interfaces/transaction-data.interface';
import { TransactionsService } from '../../transactions/transactions.service';
import { ExchangesService } from '../../exchanges/exchanges.service';

@Injectable()
export class TelegramAccountsService {
  private readonly logger = new Logger(TelegramAccountsService.name);

  constructor(
    private readonly binanceAccountService: BinanceAccountService,
    private readonly accountsSheetsService: AccountsSheetsService,
    private readonly exchangesSheetsService: ExchangesSheetsService,
    private readonly transactionsSheetsService: TransactionsSheetsService,
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
    private readonly presenter: TelegramAccountsPresenter,
  ) {}

  async getBanescoStatusMessage(): Promise<string> {
    try {
      const [sheetsBalance, allTransactions, allExchanges] = await Promise.all([
        this.accountsSheetsService.getBanescoBalance(),
        this.transactionsService.findAll({}),
        this.exchangesService.findAll({}),
      ]);

      // Pending BANESCO transactions (NEW or REVIEWED)
      const pendingBanescoTxs = allTransactions.filter(t =>
        t.platform === 'BANESCO' &&
        (t.status === 'NEW' || t.status === 'REVIEWED')
      );

      let transactionsNet = 0;
      for (const tx of pendingBanescoTxs) {
        const amount = Number(tx.amount);
        if (tx.type === 'INCOME') {
          transactionsNet += amount;
        } else {
          transactionsNet -= amount;
        }
      }

      // Pending exchanges (not REGISTERED, REJECTED, CANCELLED, FAILED)
      const pendingExchanges = allExchanges.filter(e =>
        e.status !== 'REGISTERED' &&
        e.status !== 'REJECTED' &&
        e.status !== 'CANCELLED' &&
        e.status !== 'FAILED'
      );

      let exchangesNet = 0;
      for (const ex of pendingExchanges) {
        const fiat = Number(ex.fiatAmount);
        if (ex.tradeType === 'SELL') {
          exchangesNet += fiat; // Selling crypto → VES comes into Banesco
        } else {
          exchangesNet -= fiat; // Buying crypto → VES goes out of Banesco
        }
      }

      const pendingTotal = transactionsNet + exchangesNet;
      const estimatedBalance = sheetsBalance + pendingTotal;

      return this.presenter.formatBanescoStatus(
        sheetsBalance,
        estimatedBalance,
        pendingBanescoTxs.length,
        pendingExchanges.length,
      );
    } catch (error) {
      this.logger.error(`Failed to get Banesco status: ${error.message}`);
      throw error;
    }
  }

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

  async adjustBanescoBalance(newBalance: number): Promise<{ success: boolean; message: string }> {
    try {
      const currentBalance = await this.accountsSheetsService.getBanescoBalance();

      if (currentBalance === 0) {
        throw new Error('Failed to get current Banesco balance.');
      }

      const difference = newBalance - currentBalance;

      // Get exchange rate
      const exchangeRate = await this.exchangesSheetsService.getBsDollarRate();

      // Create formula using actual fetched values (static formula that won't change if sheet values change)
      // This ensures the transaction amount is locked to the values at the time of creation
      const amountFormula = `=ABS(${currentBalance}-${newBalance})/${exchangeRate}`;

      const transaction: TransactionData = {
        date: new Date().toLocaleDateString('en-US'),
        description: 'Ajustes balance Banesco',
        debit_accounts: [],
        credit_accounts: [],
      };

      if (newBalance < currentBalance) {
        // Balance decreased - need to add expense
        transaction.debit_accounts = [
          {
            account: 'Gastos comisiones',
            amount: amountFormula as any, // Formula string
            category: 'Otros',
            subcategory: 'Comisiones',
          },
        ];
        transaction.credit_accounts = [
          { account: 'Banesco', amount: amountFormula as any },
        ];
      } else {
        // Balance increased - need to add income
        transaction.debit_accounts = [
          {
            account: 'Banesco',
            amount: amountFormula as any,
          },
        ];
        transaction.credit_accounts = [
          { account: 'Ingresos mixtos', amount: amountFormula as any },
        ];
      }

      await this.transactionsSheetsService.insertTransactionToSheet(transaction);

      const differenceInUsd = Math.abs(difference) / exchangeRate;
      const message = `✅ Banesco balance adjusted successfully!\n\n` +
        `Previous: ${currentBalance.toFixed(2)} Bs\n` +
        `New: ${newBalance.toFixed(2)} Bs\n` +
        `Difference: ${Math.abs(difference).toFixed(2)} Bs (${differenceInUsd.toFixed(2)} USD)`;

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Failed to adjust Banesco balance: ${error.message}`);
      throw error;
    }
  }
}
