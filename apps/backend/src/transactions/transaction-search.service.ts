import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../common/open-router.service';

export interface TransactionSearchCriteria {
  description?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  platform?: string;
  status?: string;
  statusIn?: string[];
  method?: string;
}

const SEARCH_SYSTEM_PROMPT = `You are a search query parser for a financial transactions database. Parse the user's natural language search into structured JSON filters.

Current date: {currentDate}

Available platforms: BANESCO, BINANCE, BANK_OF_AMERICA, WALLET, CASH_BOX
Available statuses: NEW, REVIEWED, REGISTERED, REJECTED
Available payment methods: DEBIT_CARD, PAGO_MOVIL, ELECTRONIC_TRANSFER, ZELLE, CREDIT_CARD, BINANCE_PAY, DEPOSIT, WITHDRAWAL, CASH

Return ONLY valid JSON with this structure:
{
  "description": "<text>" or null,
  "dateFrom": "YYYY-MM-DD" or null,
  "dateTo": "YYYY-MM-DD" or null,
  "amountMin": <number> or null,
  "amountMax": <number> or null,
  "platform": "<PLATFORM>" or null,
  "status": "<STATUS>" or null,
  "method": "<METHOD>" or null
}

Rules:
- description: Use for transaction names/descriptions (e.g., "uber", "netflix", "farmacia", "anthropic"). Keep the essential search term only.
- Dates: Resolve relative to current date. "yesterday"/"ayer" → single day, "january"/"enero" → Jan 1 to Jan 31, "last week"/"semana pasada" → last 7 days, "today"/"hoy" → today
- Amounts: "50" → amountMin=amountMax=50, "more than 100"/"mas de 100" → amountMin=100, "less than 50"/"menos de 50" → amountMax=50
- Platforms: "banesco" → BANESCO, "binance" → BINANCE, "bofa"/"boa"/"bank of america" → BANK_OF_AMERICA, "wallet"/"billetera" → WALLET, "cash box"/"caja" → CASH_BOX
- Statuses: "new"/"nuevo" → NEW, "reviewed"/"revisado" → REVIEWED, "registered"/"registrado" → REGISTERED, "rejected"/"rechazado" → REJECTED
- Methods: "pago movil"/"pm" → PAGO_MOVIL, "zelle" → ZELLE, "debit"/"debito" → DEBIT_CARD, "credit"/"credito" → CREDIT_CARD, "transfer"/"transferencia" → ELECTRONIC_TRANSFER
- If input is just a number, treat as amount (amountMin=amountMax=number)
- If input is a word that doesn't match any platform/status/method, treat as description
- Understand both Spanish and English
- All fields are optional; only include what can be inferred from the query`;

@Injectable()
export class TransactionSearchService {
  private readonly logger = new Logger(TransactionSearchService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async parseSearchQuery(query: string): Promise<TransactionSearchCriteria> {
    this.logger.log(`Parsing search query: "${query}"`);

    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const systemPrompt = SEARCH_SYSTEM_PROMPT.replace('{currentDate}', currentDate);

      const result = await this.openRouter.chatJson<Record<string, any>>(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        { temperature: 0.1, maxTokens: 200 },
      );

      const criteria: TransactionSearchCriteria = {};
      if (result.description) criteria.description = result.description;
      if (result.dateFrom) criteria.dateFrom = result.dateFrom;
      if (result.dateTo) criteria.dateTo = result.dateTo;
      if (result.amountMin != null) criteria.amountMin = result.amountMin;
      if (result.amountMax != null) criteria.amountMax = result.amountMax;
      if (result.platform) criteria.platform = result.platform;
      if (result.status) criteria.status = result.status;
      if (result.method) criteria.method = result.method;

      this.logger.log(`Parsed criteria: ${JSON.stringify(criteria)}`);
      return criteria;
    } catch (error) {
      this.logger.error(`Failed to parse search query: ${error.message}`);
      // Fallback: treat entire query as description search
      return { description: query };
    }
  }
}
