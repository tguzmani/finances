import { Injectable, Logger } from '@nestjs/common';
import { BinanceApiClient } from '../common/binance-api';
import { TransactionPlatform, PaymentMethod, TransactionType } from '@prisma/client';

export interface BinanceTransaction {
  date: Date;
  amount: number;
  currency: string;
  transactionId: string;
  type: TransactionType;
  method: PaymentMethod;
  platform: TransactionPlatform;
  description?: string;
}

@Injectable()
export class TransactionsBinanceService {
  private readonly logger = new Logger(TransactionsBinanceService.name);

  constructor(private readonly binanceApi: BinanceApiClient) {}

  async getDeposits(limit = 30): Promise<BinanceTransaction[]> {
    try {
      const response = await this.binanceApi.getDepositHistory({
        status: 1, // Only successful deposits
        limit,
      });

      if (!response || !Array.isArray(response)) {
        return [];
      }

      return response.map((d: any) => ({
        date: new Date(d.insertTime || d.successTime),
        amount: parseFloat(d.amount),
        currency: d.coin,
        transactionId: d.txId || d.id,
        type: TransactionType.INCOME,
        method: PaymentMethod.DEPOSIT,
        platform: TransactionPlatform.BINANCE,
      }));
    } catch (err) {
      this.logger.error(`Failed to fetch deposits: ${(err as Error).message}`);
      return [];
    }
  }

  async getWithdrawals(limit = 30): Promise<BinanceTransaction[]> {
    try {
      const response = await this.binanceApi.getWithdrawHistory({
        status: 6, // Completed withdrawals
        limit,
      });

      if (!response || !Array.isArray(response)) {
        return [];
      }

      return response.map((w: any) => ({
        date: new Date(w.applyTime || w.successTime),
        amount: parseFloat(w.amount),
        currency: w.coin,
        transactionId: w.id,
        type: TransactionType.EXPENSE,
        method: PaymentMethod.WITHDRAWAL,
        platform: TransactionPlatform.BINANCE,
      }));
    } catch (err) {
      this.logger.error(`Failed to fetch withdrawals: ${(err as Error).message}`);
      return [];
    }
  }

  async getBinancePay(limit = 30): Promise<BinanceTransaction[]> {
    try {
      const response = await this.binanceApi.getPayTransactions({ limit });
      const transactions = response?.data;

      if (!transactions || !Array.isArray(transactions)) {
        return [];
      }

      return transactions.map((p: any) => {
        const rawAmount = parseFloat(p.amount);
        const amount = Math.abs(rawAmount);
        const currency = p.currency;
        const isExpense = rawAmount < 0;
        const isCodebay = amount === 800 && currency === 'USDC';

        return {
          date: new Date(p.transactionTime),
          amount,
          currency,
          transactionId: p.transactionId || p.orderId,
          type: isExpense ? TransactionType.EXPENSE : TransactionType.INCOME,
          method: PaymentMethod.BINANCE_PAY,
          platform: TransactionPlatform.BINANCE,
          ...(isCodebay && { description: 'Codebay' }),
        };
      });
    } catch (err) {
      this.logger.error(`Failed to fetch Binance Pay: ${(err as Error).message}`);
      return [];
    }
  }
}
