import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../../common/open-router.service';
import { PaymentMethod } from '../../transaction.types';

export interface LlmParsedTransaction {
  datetime: string | null;
  amount: number | null;
  currency: 'VES' | 'USD' | null;
  transactionId: string | null;
  paymentMethod: PaymentMethod | null;
  senderType: 'RIF' | 'cedula' | null;
}

const SYSTEM_PROMPT = `You are a transaction parser. Extract transaction data from OCR text from Venezuelan receipts or payment screenshots.

Return ONLY valid JSON with this exact structure:
{
  "datetime": "YYYY-MM-DDTHH:MM:SS",
  "amount": <number>,
  "currency": "VES" | "USD",
  "transactionId": "<string>",
  "paymentMethod": "PAGO_MOVIL" | "ELECTRONIC_TRANSFER" | "DEBIT_CARD" | "CREDIT_CARD" | "CASH" | null,
  "senderType": "RIF" | "cedula" | null
}

Rules:
- datetime: Parse DD/MM/YYYY format (Venezuelan standard). Always output in 24-hour format. Convert AM/PM times to 24h (e.g., 06:48 PM → 18:48:00, 12:30 AM → 00:30:00). If time is missing, use 00:00:00
- amount: Parse Venezuelan number format (1.234,56 = 1234.56). Return the TOTAL amount (look for "TOTAL")
- transactionId: Look for "Referencia", "Factura", "Nro", "Ticket"
- paymentMethod: Determine based on these markers:
  - "PAGO_MOVIL": Contains "Descargar"+"Compartir" buttons or "Pago Móvil"
  - "ELECTRONIC_TRANSFER": Contains "Desde mi cuenta" (bank transfer)
  - "DEBIT_CARD": POS/store receipts - look for "PTO INTEGRADO", "PUNTO", "DEBITO", "FACTURA" with RIF, or any store receipt
  - "CREDIT_CARD": Contains "CREDITO" or "CREDIT"
  - "CASH": Contains "EFECTIVO" or "CASH"
  - If it's clearly a store receipt (has FACTURA, RIF, IVA) but payment method unclear, default to "DEBIT_CARD"
- senderType: "RIF" if contains J-XXXXXXXX, "cedula" if contains V-XXXXXXXX

User Instructions:
- If the user provides additional instructions, follow them to help locate the correct data in the OCR text
- User instructions may clarify which field contains the amount, where to find the date, etc.
- Example: "amount is the second PTO INTEGRADO" means look for the second occurrence of "PTO INTEGRADO" in the text

If a field cannot be determined, use null.`;

@Injectable()
export class TransactionLlmParserService {
  private readonly logger = new Logger(TransactionLlmParserService.name);

  private readonly RIF_SURCHARGE_MULTIPLIER = 1.015;      // 1.5%
  private readonly CEDULA_SURCHARGE_MULTIPLIER = 1.003;   // 0.3%

  constructor(private readonly openRouter: OpenRouterService) {}

  async parseOcrText(ocrText: string, userCaption?: string): Promise<LlmParsedTransaction> {
    this.logger.log('Parsing OCR text with LLM...');

    try {
      // Build user message with OCR text and optional caption
      let userMessage = `OCR Text:\n"""\n${ocrText}\n"""`;

      if (userCaption) {
        userMessage += `\n\nUser Instructions:\n"""\n${userCaption}\n"""`;
        this.logger.log(`User provided caption: ${userCaption}`);
      }

      const result = await this.openRouter.chatJson<LlmParsedTransaction>(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        { temperature: 0.1, maxTokens: 300 },
      );

      this.logger.log(`LLM parsed result: ${JSON.stringify(result)}`);

      return result;
    } catch (error) {
      this.logger.error(`LLM parsing failed: ${error.message}`);
      return {
        datetime: null,
        amount: null,
        currency: null,
        transactionId: null,
        paymentMethod: null,
        senderType: null,
      };
    }
  }

  applyPagoMovilSurcharge(amount: number, senderType: 'RIF' | 'cedula' | null): number {
    if (senderType === 'RIF') {
      this.logger.log(`RIF detected, applying ${(this.RIF_SURCHARGE_MULTIPLIER - 1) * 100}% surcharge`);
      return amount * this.RIF_SURCHARGE_MULTIPLIER;
    }

    // Default to cedula surcharge
    this.logger.log(`Applying cédula surcharge (${(this.CEDULA_SURCHARGE_MULTIPLIER - 1) * 100}%)`);
    return amount * this.CEDULA_SURCHARGE_MULTIPLIER;
  }

  parseDateTime(datetimeStr: string | null): Date | null {
    if (!datetimeStr) return null;

    try {
      // The datetime from receipts is in Venezuelan local time (America/Caracas = UTC-4)
      // We need to convert to UTC for storage
      // Venezuela doesn't observe DST, so it's always UTC-4

      // Parse as UTC first to avoid local timezone interpretation differences
      // between dev (Caracas) and production (UTC) environments
      const utcDateStr = datetimeStr.endsWith('Z') ? datetimeStr : `${datetimeStr}Z`;
      const parsedAsUtc = new Date(utcDateStr);
      if (isNaN(parsedAsUtc.getTime())) return null;

      // The parsed time is now stored as if it were UTC, but it's actually Venezuelan time
      // Add 4 hours to convert from Venezuela time (UTC-4) to real UTC
      const VENEZUELA_OFFSET_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
      const utcDate = new Date(parsedAsUtc.getTime() + VENEZUELA_OFFSET_MS);

      return utcDate;
    } catch {
      return null;
    }
  }
}
