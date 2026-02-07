import { Module } from '@nestjs/common';
import { BinanceApiClient } from './binance-api';
import { DateParserService } from './date-parser.service';
import { GoogleVisionOcrService } from './google-vision-ocr.service';

@Module({
  providers: [BinanceApiClient, DateParserService, GoogleVisionOcrService],
  exports: [BinanceApiClient, DateParserService, GoogleVisionOcrService],
})
export class CommonModule {}
