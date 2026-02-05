import { Module } from '@nestjs/common';
import { BinanceApiClient } from './binance-api';

@Module({
  providers: [BinanceApiClient],
  exports: [BinanceApiClient],
})
export class CommonModule {}
