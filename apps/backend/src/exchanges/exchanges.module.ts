import { Module } from '@nestjs/common';
import { ExchangesController } from './exchanges.controller';
import { ExchangesService } from './exchanges.service';
import { ExchangesBinanceService } from './exchanges-binance.service';
import { ExchangesBcvService } from './exchanges-bcv.service';
import { ExchangeRatesAggregatorService } from './exchange-rates-aggregator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ExchangesScheduler } from './exchanges.scheduler';
import { ExchangeRateService } from './exchange-rate.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [ExchangesController],
  providers: [
    ExchangesService,
    ExchangesBinanceService,
    ExchangesBcvService,
    ExchangeRatesAggregatorService,
    ExchangesScheduler,
    ExchangeRateService,
  ],
  exports: [
    ExchangesService,
    ExchangeRateService,
    ExchangesBcvService,
    ExchangeRatesAggregatorService,
  ],
})
export class ExchangesModule {}
