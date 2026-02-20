import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../common/open-router.service';
import { JOURNAL_ACCOUNTS, JOURNAL_CATEGORIES } from './journal-entry.constants';

export interface JournalClassification {
  debit_account: string;
  credit_account: string;
  category: string;
  subcategory: string;
}

const SYSTEM_PROMPT = `You are a bookkeeping classifier. Given a transaction, respond ONLY with valid JSON.

Rules:
- For EXPENSE: debit_account should be a "Gastos ..." account, credit_account should be the platform account
- For INCOME: credit_account should be an "Ingresos ..." account, debit_account should be the platform account
- For TRANSFER: both debit_account and credit_account must be Asset or Liability accounts ONLY. No "Gastos" or "Ingresos" accounts allowed. category and subcategory must be empty strings.

Asset accounts: Binance, Wallet, Banesco, Cash, Folionet, Inventario, Bofa, EVO25, Binance Portfolio, Por cobrar OneMeta, Por cobrar mixtos, Por cobrar Akivva, Por cobrar Esther
Liability accounts: Por pagar Norma, Por pagar Esther, Bofa TDC

Platform mapping:
- BANESCO → "Banesco"
- BINANCE → "Binance"
- BANK_OF_AMERICA → "Bofa"
- WALLET → "Wallet"
- CASH_BOX → "Cash"

Available accounts:
${JOURNAL_ACCOUNTS.join(', ')}

Available categories and subcategories (only for EXPENSE/INCOME, not TRANSFER):
${Object.entries(JOURNAL_CATEGORIES).map(([cat, subs]) => `${cat}: [${subs.join(', ')}]`).join('\n')}

Respond ONLY with this JSON (no markdown, no explanation):
{"debit_account": "...", "credit_account": "...", "category": "...", "subcategory": "..."}`;

@Injectable()
export class JournalEntryLlmService {
  private readonly logger = new Logger(JournalEntryLlmService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async classify(
    description: string,
    amount: number,
    type: string,
    platform: string,
  ): Promise<JournalClassification> {
    this.logger.log(`Classifying transaction: "${description}" (${type}, ${platform})`);

    const userMessage = `Transaction:\n- Description: "${description}"\n- Amount: ${amount} USD\n- Type: ${type}\n- Platform: ${platform}`;

    const result = await this.openRouter.chatJson<JournalClassification>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.1, maxTokens: 200 },
    );

    if (!result.debit_account || !result.credit_account) {
      throw new Error('Missing required fields in classification response');
    }

    // Ensure category/subcategory are at least empty strings
    result.category = result.category || '';
    result.subcategory = result.subcategory || '';

    this.logger.log(`Classification result: ${JSON.stringify(result)}`);
    return result;
  }
}
