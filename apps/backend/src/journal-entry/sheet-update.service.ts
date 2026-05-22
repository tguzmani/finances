import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import Fuse from 'fuse.js';
import { SheetsRepository } from '../common/sheets.repository';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { SHEET_UPDATE_RULES, SheetUpdateRule } from './sheet-update.rules';

export interface SheetUpdateResult {
  rule: SheetUpdateRule;
  cell: string;
  amount: number;
}

@Injectable()
export class SheetUpdateService {
  private readonly logger = new Logger(SheetUpdateService.name);
  private readonly fuse: Fuse<SheetUpdateRule>;

  constructor(
    private readonly sheetsRepository: SheetsRepository,
    private readonly exchangeRateService: ExchangeRateService,
  ) {
    this.fuse = new Fuse(SHEET_UPDATE_RULES, {
      keys: ['keywords'],
      threshold: 0.4,
      includeScore: true,
    });
  }

  /**
   * Attempts to match a transaction description against sheet update rules.
   * If matched, updates the corresponding cell in Google Sheets.
   * Returns the result if updated, null if no match.
   * Throws if matched but all cells are occupied (e.g. Neyda with both cells taken).
   */
  async trySheetUpdate(transaction: Transaction): Promise<SheetUpdateResult | null> {
    if (!transaction.description) return null;

    const rule = this.simpleMatch(transaction.description)
      ?? this.fuzzyMatch(transaction.description);

    if (!rule) return null;

    const amount = Number(transaction.amount);
    const formulaFragment = await this.buildAmountFragment(transaction);
    const cell = await this.findAvailableCell(rule);
    const fullRange = `${rule.sheet}!${cell}`;

    if (rule.accumulate) {
      const formula = await this.buildAccumulatedFormula(fullRange, formulaFragment);
      this.logger.log(`Sheet update: accumulating ${formulaFragment} to ${fullRange} via rule "${rule.name}" → ${formula}`);
      await this.sheetsRepository.updateSheetValues(fullRange, [[formula]]);
    } else {
      this.logger.log(`Sheet update: writing ${formulaFragment} to ${fullRange} via rule "${rule.name}"`);
      await this.sheetsRepository.updateSheetValues(fullRange, [[`=${formulaFragment}`]]);
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

  private fuzzyMatch(description: string): SheetUpdateRule | null {
    const results = this.fuse.search(description);
    if (results.length === 0) return null;

    const best = results[0];
    if (best.score !== undefined && best.score > 0.4) return null;

    const rule = best.item;
    if (rule.exactMatch) {
      const words = description.toLowerCase().trim().split(/\s+/);
      if (words.length !== rule.keywords.length) return null;
    }

    this.logger.log(`Fuzzy match found: "${description}" → ${rule.name} (score: ${best.score?.toFixed(3)})`);
    return rule;
  }

  private async buildAmountFragment(transaction: Transaction): Promise<string> {
    const amount = Number(transaction.amount);
    if (transaction.currency !== 'VES') return amount.toFixed(2);

    const latestRate = await this.exchangeRateService.findLatest();
    const exchangeRate = latestRate ? Number(latestRate.value) : 0;
    if (!exchangeRate) {
      throw new Error(`No exchange rate available for VES conversion (transaction ${transaction.id})`);
    }

    return `${amount.toFixed(2)}/${exchangeRate.toFixed(2)}`;
  }

  private async buildAccumulatedFormula(fullRange: string, fragment: string): Promise<string> {
    const values = await this.sheetsRepository.getSheetValues(fullRange, 'FORMULA');
    const currentValue = values?.[0]?.[0]?.toString().trim() ?? '';

    // Cell is empty or contains "$ -" (Google Sheets empty currency format)
    if (!currentValue || currentValue === '$ -' || currentValue === '$') {
      return `=${fragment}`;
    }

    // Cell already has a formula like "=6.99" or "=6.99+10.00"
    if (currentValue.startsWith('=')) {
      return `${currentValue}+${fragment}`;
    }

    // Cell has a plain number (e.g., "$6.99" or "6.99")
    const existing = parseFloat(currentValue.replace(/[$,]/g, ''));
    if (!isNaN(existing)) {
      return `=${existing.toFixed(2)}+${fragment}`;
    }

    // Fallback: start fresh
    this.logger.warn(`Unexpected cell value "${currentValue}" at ${fullRange}, starting fresh`);
    return `=${fragment}`;
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
