import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

@Injectable()
export class PagoMovilOcrService {
  private readonly logger = new Logger(PagoMovilOcrService.name);

  async extractText(imageBuffer: Buffer): Promise<string> {
    try {
      this.logger.log('Creating Tesseract worker...');
      const worker = await createWorker('spa');  // Spanish language
      this.logger.log('Worker created successfully');

      this.logger.log(`Starting OCR on ${imageBuffer.length} byte image...`);
      const { data: { text } } = await worker.recognize(imageBuffer);
      this.logger.log('OCR recognition completed');

      await worker.terminate();
      this.logger.log('Worker terminated');

      this.logger.log(`OCR extracted text (${text.length} chars)`);

      return text;
    } catch (error) {
      this.logger.error(`OCR failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      throw error;
    }
  }
}
