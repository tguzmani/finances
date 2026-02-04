import { Module } from '@nestjs/common';
import { ExchangesController } from './exchanges.controller';
import { ExchangesService } from './exchanges.service';
import { BinanceApiService } from './binance-api.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ExchangesScheduler } from './exchanges.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [ExchangesController],
  providers: [ExchangesService, BinanceApiService, ExchangesScheduler],
  exports: [ExchangesService],
})
export class ExchangesModule {}
