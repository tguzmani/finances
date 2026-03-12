import { Injectable, Logger } from '@nestjs/common';
import { GoogleVisionOcrService } from '../../common/google-vision-ocr.service';
import { PagoMovilLlmParserService, PagoMovilData } from '../../transactions/ocr/parsers/pago-movil-llm-parser.service';

@Injectable()
export class TelegramPagoMovilService {
  private readonly logger = new Logger(TelegramPagoMovilService.name);

  constructor(
    private readonly ocrService: GoogleVisionOcrService,
    private readonly pagoMovilParser: PagoMovilLlmParserService,
  ) {}

  async parseFromImage(imageBuffer: Buffer, caption?: string): Promise<PagoMovilData> {
    this.logger.log('Extracting text from image with OCR...');
    const ocrText = await this.ocrService.extractStructuredText(imageBuffer);

    if (!ocrText) {
      this.logger.warn('No text detected in image');
      return { bankCode: null, bankName: null, amount: null, phone: null, idDocument: null };
    }

    this.logger.log(`OCR text extracted (${ocrText.length} chars)`);
    return this.pagoMovilParser.parse(ocrText, caption);
  }

  async parseFromText(text: string): Promise<PagoMovilData> {
    return this.pagoMovilParser.parse(text);
  }
}
