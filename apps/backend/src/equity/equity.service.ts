import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EquityName } from '@prisma/client';
import { EquitySheetsService } from './equity-sheets.service';
import { EquityItaFetchService } from './equity-ita-fetch.service';

@Injectable()
export class EquityService {
  private readonly logger = new Logger(EquityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: EquitySheetsService,
    private readonly itaFetchService: EquityItaFetchService,
  ) {}

  async findLatestByName(name: EquityName) {
    return this.prisma.equitySnapshot.findFirst({
      where: { name },
      orderBy: { date: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return this.prisma.equitySnapshot.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
  }

  async captureAllSnapshots(): Promise<void> {
    this.logger.log('Capturing equity snapshots...');

    // ITA first — if it fails (e.g. locked session), stop the entire capture
    const itaEvo25Value = await this.itaFetchService.getItaAccountValue();

    const [equityValue, binancePnl, sheetsEvo25Value] = await Promise.all([
      this.sheetsService.getEquityValue(),
      this.sheetsService.getBinancePnl(),
      this.sheetsService.getSheetsEvo25Value(),
    ]);

    const evo25value = itaEvo25Value - sheetsEvo25Value;

    const snapshots = [
      { name: EquityName.EQUITY_SIMPLE, amount: equityValue },
      { name: EquityName.EQUITY_CRYPTO_INVESTMENT, amount: equityValue + binancePnl },
      { name: EquityName.EQUITY_FIAT_INVESTMENT, amount: equityValue + evo25value },
      { name: EquityName.EQUITY_FULL_INVESTMENT, amount: equityValue + evo25value + binancePnl },
    ];

    const now = new Date();

    for (const snapshot of snapshots) {
      await this.prisma.equitySnapshot.create({
        data: {
          date: now,
          name: snapshot.name,
          amount: snapshot.amount,
        },
      });
      this.logger.log(`Saved ${snapshot.name}: $${snapshot.amount.toFixed(2)}`);
    }

    this.logger.log('All equity snapshots captured successfully');
  }
}
