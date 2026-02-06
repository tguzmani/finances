import { Injectable } from '@nestjs/common';

export interface ParsedPagoMovilTransaction {
  date: Date;
  amount: number;
  currency: string;
  transactionId: string;
}

@Injectable()
export class PagoMovilParser {
  private readonly CURRENCY = 'VES';
  private readonly RIF_SURCHARGE_MULTIPLIER = 1.015;
  private readonly CEDULA_SURCHARGE_MULTIPLIER = 1.003;

  /**
   * Parse OCR text from Pago Móvil screenshot
   * Extracts: reference number, amount, date
   */
  parse(ocrText: string): ParsedPagoMovilTransaction | null {
    // Extract reference number (usually labeled as "Referencia" or similar)
    const referenceMatch = ocrText.match(/(?:Referencia|Ref\.?)\s*[:.]?\s*(\d+)/i);

    // Extract amount (format: Bs. 1.234,56 or Bs 1234.56)
    const amountMatch = ocrText.match(/Bs\.?\s*([\d.,]+)/i);

    // Extract date (DD/MM/YYYY or similar)
    const dateMatch = ocrText.match(/(\d{2}\/\d{2}\/\d{4})/);

    // Extract time if available (HH:MM)
    const timeMatch = ocrText.match(/(\d{2}:\d{2})/);

    if (!referenceMatch || !amountMatch) return null;

    // Remove leading zeros from reference
    const reference = parseInt(referenceMatch[1], 10).toString();
    let amount = this.parseAmount(amountMatch[1]);

    // Detect if it's RIF (starts with J) or Cédula (starts with V) and apply surcharge
    const isRIF = /J-?\d{8,9}/i.test(ocrText);
    const isCedula = /V-?\d{7,9}/i.test(ocrText);

    if (isRIF) {
      // Apply 1.5% surcharge for RIF
      amount = amount * this.RIF_SURCHARGE_MULTIPLIER;
    } else if (isCedula) {
      // Apply 0.3% surcharge for Cédula
      amount = amount * this.CEDULA_SURCHARGE_MULTIPLIER;
    } else {
      // Default to Cédula surcharge if type cannot be determined
      amount = amount * this.CEDULA_SURCHARGE_MULTIPLIER;
    }

    const date = this.parseDate(dateMatch?.[1], timeMatch?.[1]);

    return {
      date,
      amount,
      currency: this.CURRENCY,
      transactionId: reference,
    };
  }

  private parseAmount(amountStr: string): number {
    // Handle both European (1.234,56) and US (1234.56) formats
    if (amountStr.includes(',')) {
      const normalized = amountStr.replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized);
    } else {
      return parseFloat(amountStr);
    }
  }

  private parseDate(dateStr?: string, timeStr?: string): Date {
    if (dateStr) {
      const [day, month, year] = dateStr.split('/');
      const time = timeStr || '00:00';
      return new Date(`${year}-${month}-${day}T${time}:00`);
    }
    // Fallback to current date if not found
    return new Date();
  }
}
