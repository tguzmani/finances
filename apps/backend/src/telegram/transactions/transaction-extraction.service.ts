import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../common/open-router.service';
import {
  applyDraftInferenceRules,
  DRAFT_FIELD_RULES,
  TransactionDraft,
  TransactionDraftSchema,
  venezuelaNowIso,
} from './transaction-draft';

export type { TransactionDraft } from './transaction-draft';

const SYSTEM_PROMPT = `You extract structured transaction data from natural-language messages (Spanish or English) sent by the user to their personal finance bot.

Return a JSON object with these fields. Use null for any field you cannot determine from the input — DO NOT guess or fabricate.

${DRAFT_FIELD_RULES}

Examples (assume current time = 2026-05-22T22:00:00-04:00):
Input: "gasté 500 bs en la panadería"
Output: {"type":"EXPENSE","platform":"BANESCO","method":null,"currency":"VES","amount":500,"description":"panadería","date":null}

Input: "Gaste 9615.31 Bs en Farmatodo con tarjeta de debito hace 30 minutos"
Output: {"type":"EXPENSE","platform":"BANESCO","method":"DEBIT_CARD","currency":"VES","amount":9615.31,"description":"Farmatodo","date":"2026-05-22T21:30:00-04:00"}

Input: "pagué 25 dólares con bofa por netflix"
Output: {"type":"EXPENSE","platform":"BANK_OF_AMERICA","method":null,"currency":"USD","amount":25,"description":"netflix","date":null}

Input: "recibí pago"
Output: {"type":"INCOME","platform":null,"method":null,"currency":null,"amount":null,"description":"pago","date":null}

Input: "Gaste 265.15 USD de Binance a Amazon (123.95) + Bofa"
Output: {"type":"EXPENSE","platform":"BINANCE","method":null,"currency":"USDT","amount":265.15,"description":"Amazon (123.95) + Bofa","date":null}

Input: "mercado 92673.94 bs + Esther"
Output: {"type":"EXPENSE","platform":"BANESCO","method":null,"currency":"VES","amount":92673.94,"description":"mercado + Esther","date":null}
`;

@Injectable()
export class TransactionExtractionService {
  private readonly logger = new Logger(TransactionExtractionService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async extract(text: string): Promise<TransactionDraft> {
    this.logger.log(`Extracting transaction from: "${text}"`);

    const userMessage = `Current time: ${venezuelaNowIso()}\n\nUser message: ${text}`;

    const draft = await this.openRouter.chatStructured<TransactionDraft>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      TransactionDraftSchema,
      { schemaName: 'transaction_draft', temperature: 0.1, maxTokens: 300 },
    );

    return applyDraftInferenceRules(draft);
  }
}
