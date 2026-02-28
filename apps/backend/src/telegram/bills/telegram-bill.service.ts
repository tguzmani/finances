import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../common/open-router.service';

interface BillQueryResult {
  answer: string;
  data: string | null;
}

@Injectable()
export class TelegramBillService {
  private readonly logger = new Logger(TelegramBillService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async queryBill(ocrText: string, userQuery: string): Promise<BillQueryResult> {
    const systemPrompt = `You are a bill analysis assistant. You receive OCR text from a bill/receipt and answer user questions about it.

Rules:
- Return JSON with two fields: "answer" and "data"
- "answer": HTML-formatted text for Telegram (use <b>, <i>, <code> tags). Show a clear breakdown when relevant.
- "data": A clean, copyable value (number, formula, list) or null if the question is not about extractable data.
- Parse Venezuelan number format: dots are thousand separators, commas are decimal separators (e.g., 1.234,56 = 1234.56)
- For sum questions: show the breakdown in "answer", put just the total number in "data"
- For item lookups: show details in "answer", put the key value in "data"
- Keep answers concise and focused on the question
- Always respond in the same language the user asked in`;

    const result = await this.openRouter.chatJson<BillQueryResult>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Bill OCR text:\n\n${ocrText}\n\nQuestion: ${userQuery}` },
      ],
      { maxTokens: 1000 },
    );

    return result;
  }
}
