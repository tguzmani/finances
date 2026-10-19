import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../common/open-router.service';
import { AMOUNT_FORMAT_RULES } from '../common/amount-format.rules';

/**
 * How far from the amount asked for a transaction still counts as the one being
 * looked for.
 *
 * A bolívar figure is rarely remembered or quoted to the cent: the receipt says
 * 6,080.86 and what gets typed is 6,080. A Pago Móvil surcharge moves the
 * figure by a little too. Two percent covers that drift while staying far below
 * the gap between two separate purchases.
 */
export const AMOUNT_TOLERANCE = 0.02;

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
  /** The exact figure the query named, before the tolerance widened it. */
  askedAmount?: number;
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
- A question about whether a transaction exists ("tengo alguna transaccion por 6080?", "hay algo de 45 verdes?") is an amount search: amountMin=amountMax=the figure
- If input is a word that doesn't match any platform/status/method, treat as description
- Understand both Spanish and English
- All fields are optional; only include what can be inferred from the query

${AMOUNT_FORMAT_RULES}`;

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
      return this.widenExactAmount(criteria);
    } catch (error) {
      this.logger.error(`Failed to parse search query: ${error.message}`);
      // Fallback: treat entire query as description search
      return { description: query };
    }
  }

  /**
   * Turns a single amount into a window around it.
   *
   * Asking for 6,080 and being told nothing exists, while 6,080.86 sits in the
   * table, is the one answer this search must not give. A range is kept as the
   * range it already is.
   */
  private widenExactAmount(criteria: TransactionSearchCriteria): TransactionSearchCriteria {
    const { amountMin, amountMax } = criteria;

    if (amountMin == null || amountMin !== amountMax) return criteria;

    const widened = {
      ...criteria,
      askedAmount: amountMin,
      amountMin: amountMin * (1 - AMOUNT_TOLERANCE),
      amountMax: amountMin * (1 + AMOUNT_TOLERANCE),
    };

    this.logger.log(
      `Amount ${amountMin} searched as ${widened.amountMin.toFixed(2)}-${widened.amountMax.toFixed(2)} (±${AMOUNT_TOLERANCE * 100}%)`,
    );

    return widened;
  }
}
