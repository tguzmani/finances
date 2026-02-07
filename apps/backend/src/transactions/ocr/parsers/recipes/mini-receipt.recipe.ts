import { Injectable, Logger } from '@nestjs/common';
import { TransactionRecipe, TransactionRecipeResult } from './transaction-recipe.interface';

/**
 * Recipe for mini receipts (smaller format, thermal printers)
 * Format: "Monto Bs" or "Monto: Bs" instead of "Total Bs"
 * Transaction ID is optional (nice to have)
 */
@Injectable()
export class MiniReceiptRecipe implements TransactionRecipe {
  readonly name = 'mini-receipt';
  private readonly logger = new Logger(MiniReceiptRecipe.name);

  canParse(text: string): boolean {
    // Quick check for mini receipt markers
    // Look for "Monto" keyword (common in mini receipts)
    return text.includes('Monto') || text.includes('MONTO');
  }

  parse(text: string): TransactionRecipeResult {
    this.logger.log('Attempting to parse with mini-receipt recipe');

    return {
      datetime: this.extractDatetime(text),
      amount: this.extractAmount(text),
      transactionId: this.extractTransactionId(text),
    };
  }

  isValid(result: TransactionRecipeResult): boolean {
    // Only datetime and amount are MUST
    // transactionId is optional (nice to have)
    return (
      result.datetime !== null &&
      result.amount !== null
    );
  }

  private extractDatetime(text: string): Date | null {
    try {
      // Pattern 1: Fecha: DD/MM/YYYY ... Hora: H:MM:SS p. m. (split date and time)
      // Handle OCR typos: TECHA, FECHA
      const dateMatch = /(?:Fecha|Techa)[\s:]*(\d{2})\/(\d{2})\/(\d{4})/i.exec(text);
      // Allow space or colon between MM and SS (handles "12:28 47" from OCR errors)
      const timeMatch = /Hora[\s:]*(\d{1,2}):(\d{2})[\s:]*(\d{2})\s*(a\.\s*m\.|p\.\s*m\.|AM|PM)/i.exec(text);

      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        let hour = 0;
        let minutes = 0;
        let seconds = 0;

        if (timeMatch) {
          const [, h, m, s, ampm] = timeMatch;
          hour = parseInt(h);
          minutes = parseInt(m);
          seconds = parseInt(s);

          // Convert 12-hour to 24-hour format
          if (ampm.toLowerCase().includes('p') && hour !== 12) {
            hour += 12;
          } else if (ampm.toLowerCase().includes('a') && hour === 12) {
            hour = 0;
          }
        }

        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hour,
          minutes,
          seconds
        );

        return date;
      }

      // Pattern 2: DD/MM/YYYY HH:MM:SS (24-hour format with seconds)
      const pattern2 = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/;
      const match2 = text.match(pattern2);

      if (match2) {
        const [, day, month, year, hours, minutes, seconds] = match2;
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

      // Pattern 3: DD/MM/YYYY HH:MM AM/PM (12-hour format)
      const pattern3 = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i;
      const match3 = text.match(pattern3);

      if (match3) {
        const [, day, month, year, hours, minutes, ampm] = match3;
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

      // Pattern 4: DD/MM/YYYY HH:MM (24-hour format without seconds)
      const pattern4 = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/;
      const match4 = text.match(pattern4);

      if (match4) {
        const [, day, month, year, hours, minutes] = match4;
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

      // Pattern 5: DD-MM-YYYY HH:MM (alternative separator)
      const pattern5 = /(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})/;
      const match5 = text.match(pattern5);

      if (match5) {
        const [, day, month, year, hours, minutes] = match5;
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

      // Pattern 6: DD/MM/YYYY (without time)
      const pattern6 = /(\d{2})\/(\d{2})\/(\d{4})/;
      const match6 = text.match(pattern6);

      if (match6) {
        const [, day, month, year] = match6;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date;
      }

      this.logger.warn('Could not extract datetime from mini receipt');
      return null;
    } catch (error) {
      this.logger.error(`Error extracting datetime: ${error.message}`);
      return null;
    }
  }

  private extractAmount(text: string): number | null {
    try {
      // Pattern for Venezuelan format: 45.652,00
      // Mini receipts typically use "Monto" instead of "Total"
      const patterns = [
        // Monto Bs 123,45 or Monto Bs 1.234,56 (with space)
        /Monto[\s:]*Bs\.?[\s\n]+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // Monto: Bs. 123,45 (with colon and period)
        /Monto[\s:]+Bs\.[\s\n]*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // Monto: 123,45 (without Bs)
        /Monto[\s:]+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // TOTAL Bs (fallback to Total patterns)
        /(?:Total|Importe|Valor)[\s:]*Bs\.?[\s\n]+(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // Just Bs. 45.652,00 (Venezuelan format with flexible spacing)
        /Bs\.?[\s\n]*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        // Mixed format: Bs 6.775.90 (dots for both thousands and decimals - non-standard)
        /Bs\.?[\s\n]*(\d{1,3}(?:\.\d{3})+\.\d{2})/i,
        // US format patterns (less common but supported)
        /Monto[\s:]*(?:Bs\.?[\s\n]*)?(\d{1,3}(?:,\d{3})*\.\d{2})/i,
        /(?:Total|Importe|Valor)[\s:]*(?:Bs\.?[\s\n]*)?(\d{1,3}(?:,\d{3})*\.\d{2})/i,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          let amountStr = match[1];

          // Count dots to determine format
          const dotCount = (amountStr.match(/\./g) || []).length;

          // Convert Venezuelan format (45.652,00) to number
          if (amountStr.includes(',')) {
            amountStr = amountStr.replace(/\./g, '').replace(',', '.');
          } else if (dotCount >= 2) {
            // Mixed format: 6.775.90 (multiple dots - last one is decimal)
            // Replace all dots except the last one
            const parts = amountStr.split('.');
            const decimals = parts.pop(); // Last part is decimals
            amountStr = parts.join('') + '.' + decimals;
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

      this.logger.warn('Could not extract amount from mini receipt');
      return null;
    } catch (error) {
      this.logger.error(`Error extracting amount: ${error.message}`);
      return null;
    }
  }

  private extractTransactionId(text: string): string | null {
    try {
      // Transaction ID is optional for mini receipts
      // Try common patterns but don't fail if not found
      const patterns = [
        // Factura: 190981
        /Factura[\s:]*(\d{5,})/i,
        // Ticket: 123456, Boleta: 123456
        /(?:Ticket|Boleta)[\s:]*(\d{4,})/i,
        // Nro. 123456, Número: 123456
        /(?:Nro\.?|Número|N[úu]mero)[\s:]*(\d{4,})/i,
        // Ref: 789012, Referencia: 789012
        /(?:Ref\.?|Referencia)[\s:]*(\d{4,})/i,
        // Operación: 456789, Transacción: 456789
        /(?:Operaci[óo]n|Transacci[óo]n|Comprobante)[\s:]*(\d{4,})/i,
        // Lote: 1234 (shortened for mini receipts)
        /Lote[\s:]*(\d{3,})/i,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return match[1];
        }
      }

      this.logger.log('Could not extract transaction ID from mini receipt (optional field)');
      return null;
    } catch (error) {
      this.logger.error(`Error extracting transaction ID: ${error.message}`);
      return null;
    }
  }
}
