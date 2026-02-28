import { Module } from '@nestjs/common';
import { BinanceApiClient } from './binance-api';
import { BackblazeStorageService } from './backblaze-storage.service';
import { DateParserService } from './date-parser.service';
import { GoogleVisionOcrService } from './google-vision-ocr.service';
import { OpenRouterService } from './open-router.service';
import { SheetsRepository } from './sheets.repository';

@Module({
  providers: [BinanceApiClient, BackblazeStorageService, DateParserService, GoogleVisionOcrService, OpenRouterService, SheetsRepository],
  exports: [BinanceApiClient, BackblazeStorageService, DateParserService, GoogleVisionOcrService, OpenRouterService, SheetsRepository],
})
export class CommonModule {}
