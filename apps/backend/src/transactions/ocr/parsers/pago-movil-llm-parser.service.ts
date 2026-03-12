import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../../common/open-router.service';
import { formatBankList } from '../../../common/venezuelan-banks';

export interface PagoMovilData {
  bankCode: string | null;
  bankName: string | null;
  amount: number | null;
  phone: string | null;
  idDocument: string | null;
}

const SYSTEM_PROMPT = `You are a Pago Móvil data parser. Extract payment transfer data from text (which may come from OCR or user input).

This is NOT a transaction receipt — it is the data someone shares so you can send them a Pago Móvil payment.

Return ONLY valid JSON with this exact structure:
{
  "bankCode": "<4-digit bank code>",
  "bankName": "<full bank name>",
  "amount": <number or null>,
  "phone": "<phone number>",
  "idDocument": "<ID document, e.g. V12345678 or J12345678>"
}

Typical Pago Móvil data contains exactly these fields:
- Bank (name or code)
- Phone number (04XX-XXXXXXX)
- ID document (cédula or RIF)
- Optionally an amount

Rules:
- bankCode: Extract the 4-digit bank code. Match against the bank list provided below.
- bankName: The full name of the bank matching the code from the list. If no exact code match, use the name as provided in the text.
- amount: Parse Venezuelan number format (1.234,56 = 1234.56). May be null if not provided in the data.
- phone: Phone number, typically starts with 04XX. Remove dashes/spaces. Keep the full number.
- idDocument: The identity document (cédula or RIF number). This is usually a number with dots like 14.480.811 or with a prefix like V-14.480.811. Always include the letter prefix (V for cédula, J/G for RIF). Remove dots and dashes. If no letter prefix is present, assume V (cédula).
  - "RIF" in the text usually means it's a company ID (J-XXXXXXXX or similar)
  - "Cédula" or "CI" means it's a personal ID (V-XXXXXXXX)
  - A standalone number with dots (e.g. 14.480.811) is a cédula — output as V14480811

IMPORTANT - Additional context priority:
- If "Additional context" is provided, values there OVERRIDE values from the OCR text.
- The additional context often contains the amount (e.g. "7350 VES" means amount is 7350).
- The OCR text typically contains bank, phone, and ID document. The amount usually comes from the additional context.

Venezuelan Bank List:
${formatBankList()}

If a field cannot be determined, use null.`;

@Injectable()
export class PagoMovilLlmParserService {
  private readonly logger = new Logger(PagoMovilLlmParserService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async parse(text: string, additionalContext?: string): Promise<PagoMovilData> {
    this.logger.log('Parsing pago móvil data with LLM...');

    try {
      let userMessage = `Text to parse:\n"""\n${text}\n"""`;

      if (additionalContext) {
        userMessage += `\n\nAdditional context:\n"""\n${additionalContext}\n"""`;
      }

      const result = await this.openRouter.chatJson<PagoMovilData>(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        { temperature: 0.1, maxTokens: 300 },
      );

      this.logger.log(`LLM parsed pago móvil data: ${JSON.stringify(result)}`);

      return result;
    } catch (error) {
      this.logger.error(`Pago Móvil LLM parsing failed: ${error.message}`);
      return {
        bankCode: null,
        bankName: null,
        amount: null,
        phone: null,
        idDocument: null,
      };
    }
  }
}
