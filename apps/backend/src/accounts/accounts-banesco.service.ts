import { Injectable, Logger } from '@nestjs/common';
import { AccountsSheetsService } from './accounts-sheets.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ExchangesService } from '../exchanges/exchanges.service';
import { ExchangesSheetsService } from '../exchanges/exchanges-sheets.service';
import { TransactionsSheetsService } from '../transactions/transactions-sheets.service';
import { TransactionData } from '../transactions/interfaces/transaction-data.interface';

export interface BanescoStatus {
  sheetsBalance: number;
  estimatedBalance: number;
  pendingTxCount: number;
  pendingExchangeCount: number;
}

export interface BanescoAdjustResult {
  success: boolean;
  previousBalance: number;
  newBalance: number;
  difference: number;
  differenceInUsd: number;
}

@Injectable()
export class BanescoAccountService {
  private readonly logger = new Logger(BanescoAccountService.name);

  constructor(
    private readonly accountsSheetsService: AccountsSheetsService,
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
    private readonly exchangesSheetsService: ExchangesSheetsService,
    private readonly transactionsSheetsService: TransactionsSheetsService,
  ) {}

  async getBanescoStatus(): Promise<BanescoStatus> {
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

      return {
        sheetsBalance,
        estimatedBalance,
        pendingTxCount: pendingBanescoTxs.length,
        pendingExchangeCount: pendingExchanges.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get Banesco status: ${error.message}`);
      throw error;
    }
  }

  async adjustBanescoBalance(newBalance: number): Promise<BanescoAdjustResult> {
    try {
      const currentBalance = await this.accountsSheetsService.getBanescoBalance();

      if (currentBalance === 0) {
        throw new Error('Failed to get current Banesco balance.');
      }

      const difference = newBalance - currentBalance;

      // Get exchange rate
      const exchangeRate = await this.exchangesSheetsService.getBsDollarRate();

      // Create formula using actual fetched values (static formula that won't change if sheet values change)
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
            amount: amountFormula as any,
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

      return {
        success: true,
        previousBalance: currentBalance,
        newBalance,
        difference: Math.abs(difference),
        differenceInUsd,
      };
    } catch (error) {
      this.logger.error(`Failed to adjust Banesco balance: ${error.message}`);
      throw error;
    }
  }
}
