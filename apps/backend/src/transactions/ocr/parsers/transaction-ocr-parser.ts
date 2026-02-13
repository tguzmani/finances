import { Injectable, Logger } from '@nestjs/common';
import { GoogleVisionOcrService } from '../../../common/google-vision-ocr.service';
import { TransactionLlmParserService } from './transaction-llm-parser.service';
import { PaymentMethod } from '../../transaction.types';

export interface TransactionData {
  datetime: Date | null;
  amount: number | null;
  transactionId: string | null;
  currency: string; // Always present (defaults to 'VES')
  ocrText: string; // Full OCR text for debugging
  paymentMethod: PaymentMethod | null;
}

@Injectable()
export class TransactionOcrParser {
  private readonly logger = new Logger(TransactionOcrParser.name);

  constructor(
    private readonly ocrService: GoogleVisionOcrService,
    private readonly llmParser: TransactionLlmParserService,
  ) {
    this.logger.log('Initialized with LLM parser');
  }

  /**
   * Parse a transaction image (bill or Pago Móvil) and extract key information
   * Uses LLM to parse the OCR text
   * @param imageBuffer Image buffer of the transaction
   * @returns Extracted transaction data
   */
  async parseTransaction(imageBuffer: Buffer): Promise<TransactionData> {
    this.logger.log('Parsing transaction image...');

    // Extract text using Google Cloud Vision (structured text detection)
    const ocrText = await this.ocrService.extractStructuredText(imageBuffer);

    this.logger.log(`OCR Text:\n${ocrText}`);

    // Use LLM to parse the OCR text
    const llmResult = await this.llmParser.parseOcrText(ocrText);

    // Check if LLM could parse anything meaningful
    if (!llmResult.datetime && !llmResult.amount && !llmResult.transactionId) {
      this.logger.error('LLM could not extract any data from this image');
      return {
        datetime: null,
        amount: null,
        transactionId: null,
        currency: 'VES',
        ocrText,
        paymentMethod: null,
      };
    }

    // Parse datetime from string
    const datetime = this.llmParser.parseDateTime(llmResult.datetime);

    // Apply surcharge for Pago Móvil transactions
    let amount = llmResult.amount;
    if (llmResult.paymentMethod === PaymentMethod.PAGO_MOVIL && amount !== null) {
      amount = this.llmParser.applyPagoMovilSurcharge(amount, llmResult.senderType);
    }

    this.logger.log(
      `LLM extracted: datetime=${datetime}, amount=${amount}, ` +
      `transactionId=${llmResult.transactionId || 'N/A'}, paymentMethod=${llmResult.paymentMethod}`
    );

    return {
      datetime,
      amount,
      transactionId: llmResult.transactionId,
      currency: llmResult.currency || 'VES',
      ocrText,
      paymentMethod: llmResult.paymentMethod,
    };
  }
}
