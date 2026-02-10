import { Module } from '@nestjs/common';
import { BinanceApiClient } from './binance-api';
import { DateParserService } from './date-parser.service';
import { GoogleVisionOcrService } from './google-vision-ocr.service';
import { SheetsRepository } from './sheets.repository';

@Module({
  providers: [BinanceApiClient, DateParserService, GoogleVisionOcrService, SheetsRepository],
  exports: [BinanceApiClient, DateParserService, GoogleVisionOcrService, SheetsRepository],
})
export class CommonModule {}
