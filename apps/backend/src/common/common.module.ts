import { Module } from '@nestjs/common';
import { BinanceApiClient } from './binance-api';
import { DateParserService } from './date-parser.service';
import { GoogleVisionOcrService } from './google-vision-ocr.service';
import { OpenRouterService } from './open-router.service';
import { SheetsRepository } from './sheets.repository';
import { B2StorageService } from './b2-storage.service';
import { GoogleSheetConfigModule } from '../google-sheet-config/google-sheet-config.module';

@Module({
  imports: [GoogleSheetConfigModule],
  providers: [BinanceApiClient, DateParserService, GoogleVisionOcrService, OpenRouterService, SheetsRepository, B2StorageService],
  exports: [BinanceApiClient, DateParserService, GoogleVisionOcrService, OpenRouterService, SheetsRepository, B2StorageService],
})
export class CommonModule {}
