import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangesBinanceService } from './exchanges-binance.service';
import { ExchangesSheetsService } from './exchanges-sheets.service';
import { QueryExchangesDto } from './dto/query-exchanges.dto';
import { SyncExchangesDto } from './dto/sync-exchanges.dto';
import { SyncResult, TradeType } from './exchange.types';
import { Prisma, ExchangeStatus, ExchangeRateSource } from '@prisma/client';

@Injectable()
export class ExchangesService {
  private readonly logger = new Logger(ExchangesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly binanceApi: ExchangesBinanceService,
    private readonly sheetsService: ExchangesSheetsService,
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
    });
  }

  async findOne(id: number) {
    return this.prisma.exchange.findUnique({
      where: { id },
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
      exchangesUpdated: 0,
      exchangesSkipped: 0,
      transactionsCreated: 0,
      errors: [],
    };

    try {
      const trades = await this.binanceApi.getP2PHistory(tradeType, limit);
      result.exchangesFetched = trades.length;

      // Create a Map of Binance trades by orderNumber for quick lookup
      const tradesMap = new Map(trades.map(trade => [trade.orderNumber, trade]));

      // Check for PENDING exchanges that might need status updates
      const pendingExchanges = await this.prisma.exchange.findMany({
        where: { status: ExchangeStatus.PENDING },
      });

      this.logger.log(`Found ${pendingExchanges.length} PENDING exchanges to check`);

      // Update PENDING exchanges if their status changed in Binance
      for (const pendingExchange of pendingExchanges) {
        const binanceTrade = tradesMap.get(pendingExchange.orderNumber);

        if (binanceTrade) {
          const binanceStatus = this.mapBinanceStatus(binanceTrade.orderStatus);

          // If Binance shows COMPLETED, mark as REVIEWED (skip manual review)
          // Otherwise, update to the new status from Binance
          const newStatus = binanceStatus === ExchangeStatus.COMPLETED
            ? ExchangeStatus.REVIEWED
            : binanceStatus;

          if (newStatus !== pendingExchange.status) {
            try {
              await this.prisma.exchange.update({
                where: { id: pendingExchange.id },
                data: { status: newStatus },
              });

              result.exchangesUpdated++;
              this.logger.log(
                `Updated exchange ${pendingExchange.orderNumber}: ${pendingExchange.status} → ${newStatus}`
              );
            } catch (err) {
              const errorMsg = `Failed to update exchange ${pendingExchange.orderNumber}: ${(err as Error).message}`;
              this.logger.error(errorMsg);
              result.errors.push(errorMsg);
            }
          }
        }
      }

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
          // COMPLETED from Binance → REVIEWED (skip manual review)
          const mappedStatus = this.mapBinanceStatus(trade.orderStatus);
          const status = mappedStatus === ExchangeStatus.COMPLETED
            ? ExchangeStatus.REVIEWED
            : mappedStatus;

          // Create Exchange
          await this.prisma.exchange.create({
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
      `Sync complete: ${result.exchangesCreated} created, ${result.exchangesUpdated} updated, ${result.exchangesSkipped} skipped, ${result.transactionsCreated} transactions created`
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
        data: {
          value: wavg,
          source: ExchangeRateSource.INTERNAL
        },
      });
    });

    this.logger.log(`Registered ${exchangeIds.length} exchanges with WAVG ${wavg}`);

    await this.sheetsService.updateBsDollarRate(wavg);
  }

  async updateExchangeRateOnly(wavg: number): Promise<{updated: boolean, value: number}> {
    // Fetch latest exchange rate
    const latestRate = await this.prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' },
    });

    // Round wavg to match database precision (Decimal 10,2)
    const roundedWavg = Math.round(wavg * 100) / 100;

    // If latest rate exists and has same value, return no update
    if (latestRate && Number(latestRate.value) === roundedWavg) {
      this.logger.log(`Exchange rate unchanged: ${roundedWavg} VES/USD`);
      return { updated: false, value: roundedWavg };
    }

    // Save new rate
    await this.prisma.exchangeRate.create({
      data: {
        value: roundedWavg,
        source: ExchangeRateSource.INTERNAL
      },
    });

    this.logger.log(`Saved new exchange rate: ${roundedWavg} VES/USD`);

    await this.sheetsService.updateBsDollarRate(roundedWavg);

    return { updated: true, value: roundedWavg };
  }
}
