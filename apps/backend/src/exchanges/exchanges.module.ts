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
import { ExchangesSheetsService } from './exchanges-sheets.service';

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
    ExchangesSheetsService,
  ],
  exports: [
    ExchangesService,
    ExchangeRateService,
    ExchangesBcvService,
    ExchangeRatesAggregatorService,
    ExchangesSheetsService,
  ],
})
export class ExchangesModule {}
