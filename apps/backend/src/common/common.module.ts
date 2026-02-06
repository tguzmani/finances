import { Module } from '@nestjs/common';
import { BinanceApiClient } from './binance-api';
import { DateParserService } from './date-parser.service';

@Module({
  providers: [BinanceApiClient, DateParserService],
  exports: [BinanceApiClient, DateParserService],
})
export class CommonModule {}
