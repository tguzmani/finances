import { Injectable, Logger } from '@nestjs/common';
import { SheetsRepository } from '../common/sheets.repository';
import { TransactionData } from './interfaces/transaction-data.interface';

@Injectable()
export class TransactionsSheetsService {
  private readonly logger = new Logger(TransactionsSheetsService.name);
  private readonly TRANSACTIONS_RANGE = 'Libro!B:I';

  constructor(private readonly sheetsRepository: SheetsRepository) {}

  async insertTransactionToSheet(data: TransactionData): Promise<void> {
    try {
      // Get existing rows to find next row number
      const getSheet = await this.sheetsRepository.getSheetValues(this.TRANSACTIONS_RANGE);
      const existingRows = getSheet || [];
      const nextRowNumber = existingRows.length + 1;

      const rows: any[] = [];
      let isFirstRow = true;

      // Debit accounts first
      data.debit_accounts.forEach((entry, index) => {
        rows.push([
          isFirstRow ? data.date : null,
          index === 0 ? data.description : null,
          entry.account,
          null,
          this.formatAmount(entry.amount),
          null,
          entry.category || null,
          entry.subcategory || null,
        ]);
        isFirstRow = false;
      });

      // Credit accounts next
      data.credit_accounts.forEach((entry) => {
        rows.push([
          null, // No date for credit rows
          null,
          null,
          entry.account,
          null,
          this.formatAmount(entry.amount),
          null,
          null,
        ]);
      });

      const range = `Libro!B${nextRowNumber}:I${nextRowNumber + rows.length - 1}`;

      this.logger.debug(`Inserting transaction to ${range}: ${JSON.stringify(data)}`);
      await this.sheetsRepository.updateSheetValues(range, rows);
      this.logger.log(`Transaction inserted successfully at ${range}`);
    } catch (error) {
      this.logger.error(`Failed to insert transaction to sheets: ${error.message}`);
      throw error;
    }
  }

  private formatAmount(amount: number | string): string {
    // If it's already a formula string (starts with =), return as-is
    if (typeof amount === 'string' && amount.startsWith('=')) {
      return amount;
    }

    // Otherwise format as currency
    return `$${amount}`;
  }
}
