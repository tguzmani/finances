import { Injectable } from '@nestjs/common';
import {
  CheckIn,
  CheckInInitiative,
  CheckInMissReason,
  CheckInTrigger,
  Closing,
  ClosingOutcome,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BanescoAccountService, BanescoBalanceSnapshot } from '../accounts/accounts-banesco.service';
import { BinanceAccountService } from '../accounts/accounts-binance.service';
import { CashAccountService } from '../accounts/accounts-cash.service';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';

/** Venezuela has no daylight saving, so its day always starts at 04:00 UTC. */
const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;

export type ClosingWithBalances = Prisma.ClosingGetPayload<{ include: { balances: true } }>;

export interface OpenedCheckIn {
  checkIn: CheckIn;
  banesco: BanescoBalanceSnapshot;
  lastClosing: Closing | null;
}

export interface CheckInAnswer {
  checkIn: CheckIn;
  /** A /done earlier the same Caracas day, which answers "on your own" by itself. */
  closedToday: boolean;
}

/**
 * Keeps the record of how bookkeeping is going: each closing (/done) with the
 * balances it left behind, and each nightly check-in with what was answered.
 * Unanswered rows are kept on purpose; an ignored reminder is data too.
 */
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

  /** Records a check-in along with the Banesco figure it is about to show. */
  async openCheckIn(trigger: CheckInTrigger): Promise<OpenedCheckIn> {
    const [banesco, lastClosing] = await Promise.all([
      this.banescoAccountService.getBalanceSnapshot(),
      this.prisma.closing.findFirst({ orderBy: { closedAt: 'desc' } }),
    ]);

    const checkIn = await this.prisma.checkIn.create({
      data: { trigger, banescoTrackedVes: banesco.estimatedVes },
    });

    return { checkIn, banesco, lastClosing };
  }

  /**
   * "Yes" after a /done the same day means the closing came first, so the
   * initiative is recorded as the user's own without asking.
   */
  async answerCheckIn(checkInId: number, upToDate: boolean): Promise<CheckInAnswer> {
    const existing = await this.prisma.checkIn.findUniqueOrThrow({ where: { id: checkInId } });

    const closingToday = upToDate
      ? await this.prisma.closing.findFirst({
        where: { closedAt: { gte: startOfCaracasDay(existing.sentAt), lte: existing.sentAt } },
      })
      : null;

    const checkIn = await this.prisma.checkIn.update({
      where: { id: checkInId },
      data: {
        upToDate,
        answeredAt: new Date(),
        ...(closingToday && { initiative: CheckInInitiative.OWN, closingId: closingToday.id }),
      },
    });

    return { checkIn, closedToday: closingToday !== null };
  }

  async setCheckInInitiative(checkInId: number, initiative: CheckInInitiative): Promise<CheckIn> {
    return this.prisma.checkIn.update({ where: { id: checkInId }, data: { initiative } });
  }

  async setCheckInMissReason(checkInId: number, missReason: CheckInMissReason): Promise<CheckIn> {
    return this.prisma.checkIn.update({ where: { id: checkInId }, data: { missReason } });
  }

  async setCheckInNote(checkInId: number, note: string): Promise<CheckIn> {
    return this.prisma.checkIn.update({ where: { id: checkInId }, data: { note } });
  }

  async linkCheckInToClosing(checkInId: number, closingId: number): Promise<CheckIn> {
    return this.prisma.checkIn.update({ where: { id: checkInId }, data: { closingId } });
  }

  private cashBalance(status: { sheetsBalance: number; estimatedBalance: number; pendingTxCount: number }) {
    return {
      sheetBalance: status.sheetsBalance,
      estimatedBalance: status.estimatedBalance,
      pendingTxCount: status.pendingTxCount,
    };
  }
}

/** Midnight in Caracas for the day `instant` falls on, as a UTC instant. */
function startOfCaracasDay(instant: Date): Date {
  const caracas = new Date(instant.getTime() - CARACAS_OFFSET_MS);
  caracas.setUTCHours(0, 0, 0, 0);
  return new Date(caracas.getTime() + CARACAS_OFFSET_MS);
}
