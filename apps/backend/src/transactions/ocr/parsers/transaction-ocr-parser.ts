import { Injectable, Logger } from '@nestjs/common';
import { GoogleVisionOcrService } from '../../../common/google-vision-ocr.service';
import { TransactionRecipe } from './recipes/transaction-recipe.interface';
import { PlazaRecipe } from './recipes/plaza.recipe';
import { MiniReceiptRecipe } from './recipes/mini-receipt.recipe';
import { PagoMovilRecipe } from './recipes/pago-movil.recipe';

export interface TransactionData {
  datetime: Date | null;
  amount: number | null;
  transactionId: string | null;
  currency: string; // Always present (defaults to 'VES')
  ocrText: string; // Full OCR text for debugging
  recipeName?: string; // Which recipe successfully parsed this
}

@Injectable()
export class TransactionOcrParser {
  private readonly logger = new Logger(TransactionOcrParser.name);
  private readonly recipes: TransactionRecipe[];

  constructor(
    private readonly ocrService: GoogleVisionOcrService,
    private readonly plazaRecipe: PlazaRecipe,
    private readonly miniReceiptRecipe: MiniReceiptRecipe,
    private readonly pagoMovilRecipe: PagoMovilRecipe,
  ) {
    // Register recipes in priority order
    // Most specific formats first (Pago Móvil has unique buttons)
    this.recipes = [
      pagoMovilRecipe,    // Pago Móvil specific (has "Descargar"/"Compartir" buttons)
      plazaRecipe,        // Store receipts (Plaza-specific markers)
      miniReceiptRecipe,  // Generic bill fallback
    ];

    this.logger.log(
      `Initialized with ${this.recipes.length} recipe(s): ${this.recipes.map(r => r.name).join(', ')}`
    );
  }

  /**
   * Parse a transaction image (bill or Pago Móvil) and extract key information
   * Tries each recipe in order until one succeeds
   * @param imageBuffer Image buffer of the transaction
   * @returns Extracted transaction data
   */
  async parseTransaction(imageBuffer: Buffer): Promise<TransactionData> {
    this.logger.log('Parsing transaction image...');

    // Extract text using Google Cloud Vision (structured text detection)
    const ocrText = await this.ocrService.extractStructuredText(imageBuffer);

    this.logger.log(`OCR Text:\n${ocrText}`);

    // Try each recipe in order
    for (const recipe of this.recipes) {
      this.logger.log(`Checking recipe: ${recipe.name}`);

      if (!recipe.canParse(ocrText)) {
        this.logger.log(`Recipe ${recipe.name} cannot parse this text (failed canParse check)`);
        continue;
      }

      this.logger.log(`Recipe ${recipe.name} accepted, attempting parse...`);

      const result = recipe.parse(ocrText);

      if (recipe.isValid(result)) {
        this.logger.log(`✅ Recipe ${recipe.name} successfully extracted data`);
        this.logger.log(
          `Extracted: datetime=${result.datetime}, amount=${result.amount}, ` +
          `transactionId=${result.transactionId || 'N/A'}, currency=${result.currency || 'VES'}`
        );

        return {
          ...result,
          currency: result.currency || 'VES', // Default to VES if not specified
          ocrText,
          recipeName: recipe.name,
        };
      }

      this.logger.warn(`Recipe ${recipe.name} failed validation (missing required fundamentals)`);
    }

    // No recipe succeeded
    this.logger.error('❌ No recipe could extract required data from this image');

    return {
      datetime: null,
      amount: null,
      transactionId: null,
      currency: 'VES',
      ocrText,
      recipeName: undefined,
    };
  }
}
