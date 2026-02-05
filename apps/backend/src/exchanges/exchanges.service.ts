import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BinanceApiService } from './binance-api.service';
import { QueryExchangesDto } from './dto/query-exchanges.dto';
import { SyncExchangesDto } from './dto/sync-exchanges.dto';
import { SyncResult, TradeType } from './exchange.types';
import { TransactionType, TransactionPlatform } from '../transactions/transaction.types';
import { Prisma, ExchangeStatus } from '@prisma/client';

@Injectable()
export class ExchangesService {
  private readonly logger = new Logger(ExchangesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceApi: BinanceApiService
  ) {}

  async findAll(query: QueryExchangesDto) {
    const {
      fromDate,
      toDate,
      limit,
      tradeType,
      status,
      asset,
    } = query;

    const where: Prisma.ExchangeWhereInput = {};

    if (fromDate || toDate) {
      where.binanceCreatedAt = {};
      if (fromDate) where.binanceCreatedAt.gte = new Date(fromDate);
      if (toDate) where.binanceCreatedAt.lte = new Date(toDate);
    }

    if (tradeType) {
      where.tradeType = tradeType;
    }

    if (status) {
      where.status = status;
    }

    if (asset) {
      where.asset = asset;
    }

    return this.prisma.exchange.findMany({
      where,
      take: limit,
      orderBy: { binanceCreatedAt: 'desc' },
      include: {
        transactions: true,
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.exchange.findUnique({
      where: { id },
      include: {
        transactions: true,
      },
    });
  }

  async update(id: number, data: { status: ExchangeStatus }) {
    return this.prisma.exchange.update({
      where: { id },
      data,
    });
  }

  async syncFromBinance(dto: SyncExchangesDto): Promise<SyncResult> {
    const { limit = 30, tradeType = TradeType.SELL } = dto;

    this.logger.log(`Starting Binance sync: limit=${limit}, tradeType=${tradeType}`);

    const result: SyncResult = {
      exchangesFetched: 0,
      exchangesCreated: 0,
      exchangesSkipped: 0,
      transactionsCreated: 0,
      errors: [],
    };

    try {
      const trades = await this.binanceApi.getP2PHistory(tradeType, limit);
      result.exchangesFetched = trades.length;

      for (const trade of trades) {
        try {
          // Check if exchange already exists
          const existing = await this.prisma.exchange.findUnique({
            where: { orderNumber: trade.orderNumber },
          });

          if (existing) {
            this.logger.debug(`Skipping duplicate orderNumber: ${trade.orderNumber}`);
            result.exchangesSkipped++;
            continue;
          }

          // Parse amounts
          const amount = parseFloat(trade.amount);
          const amountGross = Math.round(amount * 1.002 * 100) / 100; // Add 0.2% commission and round to 2 decimals
          const fiatAmount = parseFloat(trade.totalPrice);
          const exchangeRate = parseFloat(trade.unitPrice);

          // Map Binance status to our enum
          const status = this.mapBinanceStatus(trade.orderStatus);

          // Use Prisma transaction for atomicity
          await this.prisma.$transaction(async (tx) => {
            // 1. Create Exchange
            const exchange = await tx.exchange.create({
              data: {
                orderNumber: trade.orderNumber,
                asset: trade.asset,
                amount: amount,
                amountGross: amountGross,
                fiatSymbol: trade.fiatSymbol,
                fiatAmount: fiatAmount,
                exchangeRate: exchangeRate,
                counterparty: trade.counterPartNickName || null,
                tradeType: trade.tradeType as TradeType,
                status: status,
                binanceCreatedAt: new Date(trade.createTime),
              },
            });

            result.exchangesCreated++;

            // 2. Create Transaction if trade is completed
            if (trade.orderStatus === 'COMPLETED') {
              const transactionType =
                trade.tradeType === 'SELL'
                  ? TransactionType.INCOME
                  : TransactionType.EXPENSE;

              await tx.transaction.create({
                data: {
                  date: new Date(trade.createTime),
                  amount: fiatAmount,
                  currency: 'VES',
                  transactionId: trade.orderNumber,
                  type: transactionType,
                  platform: TransactionPlatform.BINANCE,
                  exchangeId: exchange.id,
                },
              });

              result.transactionsCreated++;
            }
          });

          this.logger.debug(`Created exchange: ${trade.orderNumber}`);
        } catch (err) {
          const errorMsg = `Failed to process trade ${trade.orderNumber}: ${(err as Error).message}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = `Sync failed: ${(err as Error).message}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
    }

    this.logger.log(
      `Sync complete: ${result.exchangesCreated} created, ${result.exchangesSkipped} skipped, ${result.transactionsCreated} transactions created`
    );

    return result;
  }

  private mapBinanceStatus(binanceStatus: string): ExchangeStatus {
    const statusMap: Record<string, ExchangeStatus> = {
      COMPLETED: ExchangeStatus.COMPLETED,
      PROCESSING: ExchangeStatus.PROCESSING,
      PENDING: ExchangeStatus.PENDING,
      CANCELLED: ExchangeStatus.CANCELLED,
      FAILED: ExchangeStatus.FAILED,
    };

    return statusMap[binanceStatus] || ExchangeStatus.PENDING;
  }

  // Query methods for review flows
  async findByStatus(status: ExchangeStatus) {
    return this.prisma.exchange.findMany({
      where: { status },
      orderBy: { binanceCreatedAt: 'desc' },
    });
  }

  async getNextPendingReview() {
    return this.prisma.exchange.findFirst({
      where: {
        status: {
          in: [ExchangeStatus.COMPLETED, ExchangeStatus.PENDING],
        },
      },
      orderBy: { binanceCreatedAt: 'desc' },
    });
  }

  async countByStatus(statuses: ExchangeStatus[]): Promise<number> {
    return this.prisma.exchange.count({
      where: { status: { in: statuses } },
    });
  }

  // Business logic methods
  calculateRegisterMetrics(exchanges: any[]) {
    const terminalList = exchanges
      .map(e => e.orderNumber.slice(-4))
      .join(', ');

    const totalAmount = exchanges.reduce((sum, e) => sum + Number(e.amountGross), 0);
    const weightedSum = exchanges.reduce(
      (sum, e) => sum + Number(e.amountGross) * Number(e.exchangeRate),
      0
    );
    const wavg = Math.round(weightedSum / totalAmount);

    const amounts = exchanges.map(e => Number(e.amountGross));
    const sumFormula = `=${amounts.join('+')}`;

    return { terminalList, wavg, sumFormula, totalAmount };
  }

  async registerExchanges(
    exchangeIds: number[],
    wavg: number
  ): Promise<void> {
    // Use transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      // Update all exchanges to REGISTERED
      await tx.exchange.updateMany({
        where: { id: { in: exchangeIds } },
        data: { status: ExchangeStatus.REGISTERED },
      });

      // Save exchange rate
      await tx.exchangeRate.create({
        data: { value: wavg },
      });
    });

    this.logger.log(`Registered ${exchangeIds.length} exchanges with WAVG ${wavg}`);
  }
}
