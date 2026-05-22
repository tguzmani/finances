import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';

export interface ExpensesSummary {
  income: number;
  budget: number;
  available: number;
  totalExpenditure: number;
  savingsRate: number;
}

export interface BudgetSubcategory {
  subcategory: string;
  expenditure: number;
  available: number;
  percentUsed: number;
}

@Injectable()
export class ExpensesSheetsService {
  private readonly logger = new Logger(ExpensesSheetsService.name);
  private readonly INCOME_CELL = 'Presupuestos!B3';
  private readonly SUMMARY_RANGE = 'Presupuestos!E2:E5';
  private readonly BUDGETS_RANGE = 'Presupuestos!B9:G30';

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  async getSummary(): Promise<ExpensesSummary> {
    try {
      const [summaryValues, incomeValues] = await Promise.all([
        this.sheetsRepository.getSheetValues(this.SUMMARY_RANGE),
        this.sheetsRepository.getSheetValues(this.INCOME_CELL),
      ]);
      this.logger.debug(`Raw summary values: ${JSON.stringify(summaryValues)}`);
      this.logger.debug(`Raw income value: ${JSON.stringify(incomeValues)}`);

      if (!summaryValues || summaryValues.length < 4) {
        this.logger.warn('Incomplete summary data from Presupuestos sheet');
        return { income: 0, budget: 0, available: 0, totalExpenditure: 0, savingsRate: 0 };
      }

      return {
        income: this.parseNumericValue(incomeValues?.[0]?.[0]),
        budget: this.parseNumericValue(summaryValues[0]?.[0]),
        available: this.parseNumericValue(summaryValues[1]?.[0]),
        totalExpenditure: this.parseNumericValue(summaryValues[2]?.[0]),
        savingsRate: this.parseNumericValue(summaryValues[3]?.[0]),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch expenses summary: ${error.message}`);
      throw error;
    }
  }

  async getBudgets(): Promise<BudgetSubcategory[]> {
    try {
      const values = await this.sheetsRepository.getSheetValues(this.BUDGETS_RANGE);
      this.logger.debug(`Raw budgets values: ${JSON.stringify(values)}`);

      if (!values || values.length === 0) {
        this.logger.warn('No budget data found in Presupuestos sheet');
        return [];
      }

      // Columns: B=subcategory(0), C(1), D(2), E=expenditure(3), F=available(4), G=percentUsed(5)
      return values
        .filter((row) => row[0] && String(row[0]).trim() !== '')
        .map((row) => ({
          subcategory: String(row[0]).trim(),
          expenditure: this.parseNumericValue(row[3]),
          available: this.parseNumericValue(row[4]),
          percentUsed: this.parseNumericValue(row[5]),
        }));
    } catch (error) {
      this.logger.error(`Failed to fetch budgets: ${error.message}`);
      throw error;
    }
  }

  private parseNumericValue(raw: unknown): number {
    if (raw == null) return 0;
    const cleaned = String(raw).replace(/[$%\s,]/g, '');
    if (cleaned === '' || cleaned === '-') return 0;
    const value = parseFloat(cleaned);
    if (isNaN(value)) {
      this.logger.warn(`Invalid numeric value: "${raw}"`);
      return 0;
    }
    return value;
  }
}
