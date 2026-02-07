import { Injectable, Logger } from '@nestjs/common';
import { TransactionRecipe, TransactionRecipeResult } from './transaction-recipe.interface';

/**
 * Recipe for Pago Móvil transactions
 * Format: Mobile payment screenshots with reference number and amount
 * Applies surcharge based on sender type (RIF vs Cédula)
 */
@Injectable()
export class PagoMovilRecipe implements TransactionRecipe {
  readonly name = 'pago-movil';
  private readonly logger = new Logger(PagoMovilRecipe.name);
  private readonly CURRENCY = 'VES';
  private readonly RIF_SURCHARGE_MULTIPLIER = 1.015;      // 1.5%
  private readonly CEDULA_SURCHARGE_MULTIPLIER = 1.003;   // 0.3%

  canParse(text: string): boolean {
    // Quick check for Pago Móvil markers
    // Pago Móvil screenshots always have "Descargar" and "Compartir" buttons at the bottom
    const hasButtons = /Descargar/i.test(text) && /Compartir/i.test(text);

    if (hasButtons) {
      return true;
    }

    // Fallback: check for reference and amount (less specific)
    return /(?:Referencia|Ref\.?)\s*[:.]?\s*\d+/i.test(text) &&
           /Bs\.?\s*[\d.,]+/i.test(text);
  }

  parse(text: string): TransactionRecipeResult {
    return {
      datetime: this.extractDatetime(text),
      amount: this.extractAmount(text), // Includes surcharge logic!
      transactionId: this.extractTransactionId(text),
      currency: this.CURRENCY,
    };
  }

  isValid(result: TransactionRecipeResult): boolean {
    // All 3 fundamentals required for Pago Móvil
    return (
      result.datetime !== null &&
      result.amount !== null &&
      result.transactionId !== null
    );
  }

  private extractAmount(text: string): number | null {
    try {
      // 1. Extract base amount: Bs. 1.234,56 or Bs 1234.56
      const amountMatch = text.match(/Bs\.?\s*([\d.,]+)/i);
      if (!amountMatch) {
        this.logger.warn('Could not find amount in Pago Móvil text');
        return null;
      }

      let amount = this.parseAmountString(amountMatch[1]);

      // 2. Apply surcharge based on sender type
      const isRIF = /J-?\d{8,9}/i.test(text);
      const isCedula = /V-?\d{7,9}/i.test(text);

      if (isRIF) {
        this.logger.log(`RIF detected, applying ${(this.RIF_SURCHARGE_MULTIPLIER - 1) * 100}% surcharge`);
        amount = amount * this.RIF_SURCHARGE_MULTIPLIER;
      } else if (isCedula) {
        this.logger.log(`Cédula detected, applying ${(this.CEDULA_SURCHARGE_MULTIPLIER - 1) * 100}% surcharge`);
        amount = amount * this.CEDULA_SURCHARGE_MULTIPLIER;
      } else {
        this.logger.log(`No ID type detected, defaulting to Cédula surcharge`);
        // Default to Cédula surcharge if type unknown
        amount = amount * this.CEDULA_SURCHARGE_MULTIPLIER;
      }

      return amount;
    } catch (error) {
      this.logger.error(`Error extracting amount: ${error.message}`);
      return null;
    }
  }

  private extractTransactionId(text: string): string | null {
    try {
      const match = text.match(/(?:Referencia|Ref\.?)\s*[:.]?\s*(\d+)/i);
      if (!match) {
        this.logger.warn('Could not find reference number in Pago Móvil text');
        return null;
      }

      // Remove leading zeros (convert to number then back to string)
      return parseInt(match[1], 10).toString();
    } catch (error) {
      this.logger.error(`Error extracting transaction ID: ${error.message}`);
      return null;
    }
  }

  private extractDatetime(text: string): Date | null {
    try {
      // Pattern: DD/MM/YYYY
      const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      // Pattern: HH:MM (optional)
      const timeMatch = text.match(/(\d{2}:\d{2})/);

      if (dateMatch) {
        const [day, month, year] = dateMatch[1].split('/');
        const time = timeMatch ? timeMatch[1] : '00:00';
        return new Date(`${year}-${month}-${day}T${time}:00`);
      }

      // Fallback to current date (as original parser does)
      this.logger.warn('Could not extract date from Pago Móvil, using current date');
      return new Date();
    } catch (error) {
      this.logger.error(`Error extracting datetime: ${error.message}`);
      return new Date();
    }
  }

  private parseAmountString(amountStr: string): number {
    // Handle Venezuelan format (1.234,56) and US format (1234.56)
    if (amountStr.includes(',')) {
      // Venezuelan format: remove dots (thousands separator), replace comma with dot
      return parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
    }
    // US format: just remove commas
    return parseFloat(amountStr);
  }
}
