import { Injectable, Logger } from '@nestjs/common';
import { TransactionRecipe, TransactionRecipeResult } from './transaction-recipe.interface';

/**
 * Recipe for Automercados Plaza's receipts
 * Format: Thermal printer, SENIAT header, Factura number
 */
@Injectable()
export class PlazaRecipe implements TransactionRecipe {
  readonly name = 'plaza';
  private readonly logger = new Logger(PlazaRecipe.name);

  canParse(text: string): boolean {
    // Quick check for Plaza-specific markers
    return (
      text.includes('SENIAT') ||
      text.includes('AUTOMERCADOS PLAZA') ||
      text.includes('PLAZAS GALERIAS')
    );
  }

  parse(text: string): TransactionRecipeResult {
    this.logger.log('Attempting to parse with Plaza recipe');

    return {
      datetime: this.extractDatetime(text),
      amount: this.extractAmount(text),
      transactionId: this.extractTransactionId(text),
    };
  }

  isValid(result: TransactionRecipeResult): boolean {
    return (
      result.datetime !== null &&
      result.amount !== null &&
      result.transactionId !== null
    );
  }

  private extractDatetime(text: string): Date | null {
    try {
      // Pattern 1: DD/MM/YYYY HH:MM:SS (24-hour format with seconds)
      const pattern1 = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/;
      const match1 = text.match(pattern1);

      if (match1) {
        const [, day, month, year, hours, minutes, seconds] = match1;
        const hour = parseInt(hours);

        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hour,
          parseInt(minutes),
          parseInt(seconds)
        );

        return date;
      }

      // Pattern 2: DD/MM/YYYY HH:MM AM/PM (12-hour format)
      const pattern2 = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i;
      const match2 = text.match(pattern2);

      if (match2) {
        const [, day, month, year, hours, minutes, ampm] = match2;
        let hour = parseInt(hours);

        // Convert 12-hour to 24-hour format
        if (ampm.toUpperCase() === 'PM' && hour !== 12) {
          hour += 12;
        } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
          hour = 0;
        }

        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hour,
          parseInt(minutes)
        );

        return date;
      }

      // Pattern 3: DD/MM/YYYY HH:MM (24-hour format without seconds)
      const pattern3 = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/;
      const match3 = text.match(pattern3);

      if (match3) {
        const [, day, month, year, hours, minutes] = match3;
        const hour = parseInt(hours);

        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hour,
          parseInt(minutes)
        );

        return date;
      }

      // Pattern 4: DD/MM/YYYY (without time)
      const pattern4 = /(\d{2})\/(\d{2})\/(\d{4})/;
      const match4 = text.match(pattern4);

      if (match4) {
        const [, day, month, year] = match4;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date;
      }

      this.logger.warn('Could not extract datetime from Plaza receipt');
      return null;
    } catch (error) {
      this.logger.error(`Error extracting datetime: ${error.message}`);
      return null;
    }
  }

  private extractAmount(text: string): number | null {
    try {
      // Pattern for Venezuelan format: 45.652,00
      // Use [\s\n]* to handle large spaces and line breaks (space-between layout)
      const patterns = [
        // TOTAL Bs      26.364,61 (with lots of spaces or even line breaks)
        /(?:Monto|Total|Importe|Valor)[\s:]*Bs\.?[\s\n]+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // PTO INTEGRADO 26.364,61 or similar
        /PTO[\s\n]+INTEGRADO[\s\n]+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // US format with keyword
        /(?:Monto|Total|Importe|Valor)[\s:]*(?:Bs\.?[\s\n]*)?(\d{1,3}(?:,\d{3})*\.\d{2})/i,
        // Just Bs. 45.652,00 (Venezuelan format with flexible spacing)
        /Bs\.?[\s\n]*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // Just Bs. 45,652.00 (US format)
        /Bs\.?[\s\n]*(\d{1,3}(?:,\d{3})*\.\d{2})/i,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          let amountStr = match[1];

          // Convert Venezuelan format (45.652,00) to number
          if (amountStr.includes(',')) {
            amountStr = amountStr.replace(/\./g, '').replace(',', '.');
          } else {
            // If it's US format (45,652.00), just remove commas
            amountStr = amountStr.replace(/,/g, '');
          }

          const amount = parseFloat(amountStr);

          if (!isNaN(amount)) {
            return amount;
          }
        }
      }

      this.logger.warn('Could not extract amount from Plaza receipt');
      return null;
    } catch (error) {
      this.logger.error(`Error extracting amount: ${error.message}`);
      return null;
    }
  }

  private extractTransactionId(text: string): string | null {
    try {
      // Common patterns for transaction IDs in Plaza receipts
      const patterns = [
        // Factura: 190981 (PRIORITY - use this first)
        /Factura[\s:]*(\d{5,})/i,
        // Nro. 123456, Número: 123456
        /(?:Nro\.?|Número|N[úu]mero)[\s:]*(\d{6,})/i,
        // Ref: 789012, Referencia: 789012
        /(?:Ref\.?|Referencia)[\s:]*(\d{6,})/i,
        // Operación: 456789, Transacción: 456789, Comprobante: 456789
        /(?:Operaci[óo]n|Transacci[óo]n|Comprobante)[\s:]*(\d{6,})/i,
        // Ticket: 123456, Boleta: 123456
        /(?:Ticket|Boleta)[\s:]*(\d{6,})/i,
        // Lote: 1234
        /Lote[\s:]*(\d{4,})/i,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return match[1];
        }
      }

      this.logger.warn('Could not extract transaction ID from Plaza receipt');
      return null;
    } catch (error) {
      this.logger.error(`Error extracting transaction ID: ${error.message}`);
      return null;
    }
  }
}
