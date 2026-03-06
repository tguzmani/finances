import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { SheetsRepository } from '../common/sheets.repository';
import { OpenRouterService } from '../common/open-router.service';
import { SHEET_UPDATE_RULES, SheetUpdateRule } from './sheet-update.rules';

export interface SheetUpdateResult {
  rule: SheetUpdateRule;
  cell: string;
  amount: number;
}

@Injectable()
export class SheetUpdateService {
  private readonly logger = new Logger(SheetUpdateService.name);

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly openRouter: OpenRouterService,
  ) {}

  /**
   * Attempts to match a transaction description against sheet update rules.
   * If matched, updates the corresponding cell in Google Sheets.
   * Returns the result if updated, null if no match.
   * Throws if matched but all cells are occupied (e.g. Neyda with both cells taken).
   */
  async trySheetUpdate(transaction: Transaction): Promise<SheetUpdateResult | null> {
    if (!transaction.description) return null;

    const rule = this.simpleMatch(transaction.description)
      ?? await this.llmMatch(transaction.description);

    if (!rule) return null;

    const amount = Number(transaction.amount);
    const cell = await this.findAvailableCell(rule);
    const fullRange = `${rule.sheet}!${cell}`;

    if (rule.accumulate) {
      const formula = await this.buildAccumulatedFormula(fullRange, amount);
      this.logger.log(`Sheet update: accumulating ${amount} to ${fullRange} via rule "${rule.name}" → ${formula}`);
      await this.sheetsRepository.updateSheetValues(fullRange, [[formula]]);
    } else {
      this.logger.log(`Sheet update: writing ${amount} to ${fullRange} via rule "${rule.name}"`);
      await this.sheetsRepository.updateSheetValues(fullRange, [[amount]]);
    }

    return { rule, cell: fullRange, amount };
  }

  private simpleMatch(description: string): SheetUpdateRule | null {
    const normalized = description.toLowerCase().trim();

    for (const rule of SHEET_UPDATE_RULES) {
      if (rule.exactMatch) {
        const allKeywordsMatch = rule.keywords.every(
          (keyword) => normalized.includes(keyword.toLowerCase()),
        );
        // For exact match, description should only contain the keywords (no extra words)
        const words = normalized.split(/\s+/);
        const keywordsNormalized = rule.keywords.map((k) => k.toLowerCase());
        const isExact = words.length === keywordsNormalized.length
          && words.every((w) => keywordsNormalized.includes(w));

        if (allKeywordsMatch && isExact) {
          this.logger.log(`Simple exact match found: "${description}" → ${rule.name}`);
          return rule;
        }
      } else {
        const allKeywordsMatch = rule.keywords.every(
          (keyword) => normalized.includes(keyword.toLowerCase()),
        );
        if (allKeywordsMatch) {
          this.logger.log(`Simple match found: "${description}" → ${rule.name}`);
          return rule;
        }
      }
    }
    return null;
  }

  private async llmMatch(description: string): Promise<SheetUpdateRule | null> {
    if (description.length > 60) return null;

    const rulesList = SHEET_UPDATE_RULES
      .map((r, i) => {
        const matchNote = r.exactMatch ? ' (exact match only)' : '';
        return `${i + 1}. ${r.keywords.join(' ')}${matchNote}`;
      })
      .join('\n');

    const prompt = `Given this transaction description: "${description}"

Does it match any of these known transaction types (considering possible typos/variations)?
${rulesList}

Important: "exact match only" means the description must refer to that concept alone, not combined with other words.

Respond with ONLY the number if it matches, or "none" if it doesn't match any.`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0, maxTokens: 10 },
      );

      const answer = response.trim();
      if (answer === 'none') return null;

      const index = parseInt(answer, 10);
      if (isNaN(index) || index < 1 || index > SHEET_UPDATE_RULES.length) return null;

      const rule = SHEET_UPDATE_RULES[index - 1];
      this.logger.log(`LLM match found: "${description}" → ${rule.name}`);
      return rule;
    } catch (error) {
      this.logger.error(`LLM match failed: ${error.message}`);
      return null;
    }
  }

  private async buildAccumulatedFormula(fullRange: string, amount: number): Promise<string> {
    const values = await this.sheetsRepository.getSheetValues(fullRange);
    const currentValue = values?.[0]?.[0]?.toString().trim() ?? '';
    const formatted = amount.toFixed(2);

    // Cell is empty or contains "$ -" (Google Sheets empty currency format)
    if (!currentValue || currentValue === '$ -' || currentValue === '$') {
      return `=${formatted}`;
    }

    // Cell already has a formula like "=6.99" or "=6.99+10.00"
    if (currentValue.startsWith('=')) {
      return `${currentValue}+${formatted}`;
    }

    // Cell has a plain number (e.g., "$6.99" or "6.99")
    const existing = parseFloat(currentValue.replace(/[$,]/g, ''));
    if (!isNaN(existing)) {
      return `=${existing.toFixed(2)}+${formatted}`;
    }

    // Fallback: start fresh
    this.logger.warn(`Unexpected cell value "${currentValue}" at ${fullRange}, starting fresh`);
    return `=${formatted}`;
  }

  private async findAvailableCell(rule: SheetUpdateRule): Promise<string> {
    if (rule.cells.length === 1) {
      return rule.cells[0].cell;
    }

    // Multiple cells: find the first empty one
    const cellValues: Record<string, string> = {};
    for (const cellDef of rule.cells) {
      const fullRange = `${rule.sheet}!${cellDef.cell}`;
      const values = await this.sheetsRepository.getSheetValues(fullRange);
      const cellValue = values?.[0]?.[0];

      const strValue = cellValue?.toString().trim() ?? '';
      cellValues[cellDef.cell] = strValue;

      const numericOnly = strValue.replace(/[^0-9.]/g, '');
      const numValue = numericOnly ? Number(numericOnly) : 0;
      if (!strValue || numValue === 0) {
        return cellDef.cell;
      }
    }

    // All cells are occupied
    const cellDetails = Object.entries(cellValues)
      .map(([cell, val]) => `${cell}="${val}"`)
      .join(', ');
    this.logger.error(`All cells occupied for "${rule.name}": ${cellDetails}`);
    throw new Error(
      `All cells for "${rule.name}" are already filled (${cellDetails}). Please update manually.`,
    );
  }
}
