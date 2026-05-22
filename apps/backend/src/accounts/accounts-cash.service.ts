import { Injectable, Logger } from '@nestjs/common';
import { AccountsSheetsService } from './accounts-sheets.service';
import { TransactionsService } from '../transactions/transactions.service';

export interface CashAccountStatus {
  sheetsBalance: number;
  estimatedBalance: number;
  pendingTxCount: number;
}

@Injectable()
export class CashAccountService {
  private readonly logger = new Logger(CashAccountService.name);

  constructor(
    private readonly accountsSheetsService: AccountsSheetsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getWalletStatus(): Promise<CashAccountStatus> {
    try {
      const [sheetsBalance, allTransactions] = await Promise.all([
        this.accountsSheetsService.getWalletBalance(),
        this.transactionsService.findAll({}),
      ]);

      const pendingTxs = allTransactions.filter(t =>
        t.platform === 'WALLET' &&
        (t.status === 'NEW' || t.status === 'REVIEWED')
      );

      let transactionsNet = 0;
      for (const tx of pendingTxs) {
        const amount = Number(tx.amount);
        if (tx.type === 'INCOME') {
          transactionsNet += amount;
        } else {
          transactionsNet -= amount;
        }
      }

      return {
        sheetsBalance,
        estimatedBalance: sheetsBalance + transactionsNet,
        pendingTxCount: pendingTxs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get Wallet status: ${error.message}`);
      throw error;
    }
  }

  async getCashBoxStatus(): Promise<CashAccountStatus> {
    try {
      const [sheetsBalance, allTransactions] = await Promise.all([
        this.accountsSheetsService.getCashBoxBalance(),
        this.transactionsService.findAll({}),
      ]);

      const pendingTxs = allTransactions.filter(t =>
        t.platform === 'CASH_BOX' &&
        (t.status === 'NEW' || t.status === 'REVIEWED')
      );

      let transactionsNet = 0;
      for (const tx of pendingTxs) {
        const amount = Number(tx.amount);
        if (tx.type === 'INCOME') {
          transactionsNet += amount;
        } else {
          transactionsNet -= amount;
        }
      }

      return {
        sheetsBalance,
        estimatedBalance: sheetsBalance + transactionsNet,
        pendingTxCount: pendingTxs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get CashBox status: ${error.message}`);
      throw error;
    }
  }

  async getBofaCreditCardStatus(): Promise<CashAccountStatus> {
    try {
      const [sheetsBalance, allTransactions] = await Promise.all([
        this.accountsSheetsService.getBofaCreditCardBalance(),
        this.transactionsService.findAll({}),
      ]);

      const pendingTxs = allTransactions.filter(t =>
        t.platform === 'BANK_OF_AMERICA' &&
        (t.status === 'NEW' || t.status === 'REVIEWED')
      );

      // Liability account: expenses increase balance, incomes reduce it
      let transactionsNet = 0;
      for (const tx of pendingTxs) {
        const amount = Number(tx.amount);
        if (tx.type === 'INCOME') {
          transactionsNet -= amount;
        } else {
          transactionsNet += amount;
        }
      }

      return {
        sheetsBalance,
        estimatedBalance: sheetsBalance + transactionsNet,
        pendingTxCount: pendingTxs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get BofA Credit Card status: ${error.message}`);
      throw error;
    }
  }
}
