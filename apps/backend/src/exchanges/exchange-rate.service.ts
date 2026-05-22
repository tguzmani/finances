import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRate, ExchangeRateSource } from '@prisma/client';

@Injectable()
export class ExchangeRateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    value: number,
    source: ExchangeRateSource = ExchangeRateSource.INTERNAL
  ): Promise<ExchangeRate> {
    const rate = await this.prisma.exchangeRate.create({
      data: { value, source },
    });
    this.eventEmitter.emit('exchange-rate.created');
    return rate;
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
