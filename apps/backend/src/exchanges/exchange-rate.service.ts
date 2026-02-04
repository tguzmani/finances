import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRate } from '@prisma/client';

@Injectable()
export class ExchangeRateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(value: number): Promise<ExchangeRate> {
    return this.prisma.exchangeRate.create({
      data: { value },
    });
  }

  async findAll(): Promise<ExchangeRate[]> {
    return this.prisma.exchangeRate.findMany({
      orderBy: { date: 'desc' },
    });
  }

  async findLatest(): Promise<ExchangeRate | null> {
    return this.prisma.exchangeRate.findFirst({
      orderBy: { date: 'desc' },
    });
  }
}
