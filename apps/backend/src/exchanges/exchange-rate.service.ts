import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRate, ExchangeRateSource } from '@prisma/client';

@Injectable()
export class ExchangeRateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    value: number,
    source: ExchangeRateSource = ExchangeRateSource.INTERNAL
  ): Promise<ExchangeRate> {
    return this.prisma.exchangeRate.create({
      data: { value, source },
    });
  }

  async findAll(source?: ExchangeRateSource): Promise<ExchangeRate[]> {
    return this.prisma.exchangeRate.findMany({
      where: source ? { source } : undefined,
      orderBy: { date: 'desc' },
    });
  }

  async findLatest(
    source: ExchangeRateSource = ExchangeRateSource.INTERNAL
  ): Promise<ExchangeRate | null> {
    return this.prisma.exchangeRate.findFirst({
      where: { source },
      orderBy: { date: 'desc' },
    });
  }
}
