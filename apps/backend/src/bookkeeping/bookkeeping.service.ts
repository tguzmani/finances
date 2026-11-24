import { Injectable } from '@nestjs/common';
import {
  Closing,
  ClosingOutcome,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BanescoAccountService } from '../accounts/accounts-banesco.service';
import { BinanceAccountService } from '../accounts/accounts-binance.service';
import { CashAccountService } from '../accounts/accounts-cash.service';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';

export type ClosingWithBalances = Prisma.ClosingGetPayload<{ include: { balances: true } }>;

@Injectable()
export class BookkeepingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly banescoAccountService: BanescoAccountService,
    private readonly binanceAccountService: BinanceAccountService,
    private readonly cashAccountService: CashAccountService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /** Snapshots every balance and records the closing. */
  async close(): Promise<ClosingWithBalances> {
    const [banesco, binance, wallet, cashBox, bofa, latestRate] = await Promise.all([
      this.banescoAccountService.getBanescoStatus(),
      this.binanceAccountService.getBinanceStablecoinStatus(),
      this.cashAccountService.getWalletStatus(),
      this.cashAccountService.getCashBoxStatus(),
      this.cashAccountService.getBofaCreditCardStatus(),
      this.exchangeRateService.findLatest(),
    ]);

    const balances: Prisma.ClosingBalanceCreateWithoutClosingInput[] = [
      {
        account: 'BANESCO',
        currency: 'VES',
        sheetBalance: banesco.sheetsBalance,
        estimatedBalance: banesco.estimatedBalance,
        pendingTxCount: banesco.pendingTxCount,
        pendingExchangeCount: banesco.pendingExchangeCount,
      },
      {
        account: 'BINANCE',
        currency: 'USD',
        sheetBalance: binance.sheetsBalance,
        estimatedBalance: binance.estimatedBalance,
        actualBalance: binance.overview.totalBalance,
        pendingExchangeCount: binance.pendingExchangeCount,
      },
      { account: 'WALLET', currency: 'USD', ...this.cashBalance(wallet) },
      { account: 'CASH_BOX', currency: 'USD', ...this.cashBalance(cashBox) },
      { account: 'BOFA_CREDIT_CARD', currency: 'USD', ...this.cashBalance(bofa) },
    ];

    return this.prisma.closing.create({
      data: {
        exchangeRate: latestRate ? latestRate.value : null,
        balances: { create: balances },
      },
      include: { balances: true },
    });
  }

  async setClosingOutcome(closingId: number, outcome: ClosingOutcome): Promise<Closing> {
    return this.prisma.closing.update({
      where: { id: closingId },
      data: { outcome, answeredAt: new Date() },
    });
  }

  async setClosingNote(closingId: number, note: string): Promise<Closing> {
    return this.prisma.closing.update({
      where: { id: closingId },
      data: { note },
    });
  }

  private cashBalance(status: { sheetsBalance: number; estimatedBalance: number; pendingTxCount: number }) {
    return {
      sheetBalance: status.sheetsBalance,
      estimatedBalance: status.estimatedBalance,
      pendingTxCount: status.pendingTxCount,
    };
  }
}
