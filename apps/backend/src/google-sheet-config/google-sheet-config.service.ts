import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogleSheetConfigService {
  private readonly logger = new Logger(GoogleSheetConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByDate(date: Date) {
    return this.prisma.googleSheetConfig.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }

  async findCurrent() {
    return this.findByDate(new Date());
  }

  async getCurrentSheetId(): Promise<string | undefined> {
    const latest = await this.prisma.googleSheetConfig.findFirst({
      orderBy: { endDate: 'desc' },
    });
    return latest?.googleSheetId;
  }

  async createConfig(googleSheetId: string, startDate: Date, endDate: Date, name: string) {
    return this.prisma.googleSheetConfig.create({
      data: {
        googleSheetId,
        name,
        startDate,
        endDate,
      },
    });
  }

  async getOrDetermineNextConfig(): Promise<{ startDate: Date; endDate: Date; name: string }> {
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    const currentMonthStart = new Date(Date.UTC(currentYear, currentMonth, 1));
    const currentMonthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59));

    const existingCurrentMonth = await this.findByDate(currentMonthStart);

    if (existingCurrentMonth) {
      // Current month exists, create for next month
      const nextMonth = currentMonth + 1;
      const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const normalizedMonth = nextMonth > 11 ? 0 : nextMonth;

      const startDate = new Date(Date.UTC(nextYear, normalizedMonth, 1));
      const endDate = new Date(Date.UTC(nextYear, normalizedMonth + 1, 0, 23, 59, 59));
      const name = this.formatMonthName(startDate);

      return { startDate, endDate, name };
    }

    // Current month doesn't exist, create for current month
    const name = this.formatMonthName(currentMonthStart);
    return { startDate: currentMonthStart, endDate: currentMonthEnd, name };
  }

  private formatMonthName(date: Date): string {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
}
