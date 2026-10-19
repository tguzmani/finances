import { Injectable, Logger } from '@nestjs/common';
import { parseWrittenAmount } from '../../common/written-amount';

export interface StatementRow {
  date: Date;
  reference: string;
  description: string;
  /** Negative when money left the account, positive when it arrived. */
  amount: number;
}

/** The columns of one row, as they were written. */
interface RawRow {
  date: string;
  reference: string;
  description: string;
  amountText: string;
  /** Anything written past the running balance, such as the user's "xx". */
  marker: string;
}

/** A column that opens with a date opens a row. */
const DATE_START = /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/;

/** What the user writes beside a row that is not part of the check. */
const IGNORE_MARKER = /^\s*x+\s*$/i;

/**
 * Reads a bank statement pasted as text.
 *
 * The paste still has its columns, so the table is read as the table it is.
 * Nothing here guesses: every figure that reaches the comparison is the one
 * that was pasted, character for character.
 */
@Injectable()
export class StatementParser {
  private readonly logger = new Logger(StatementParser.name);

  parse(text: string): StatementRow[] {
    const rows: StatementRow[] = [];
    let pending: string[] = [];

    const flush = () => {
      if (pending.length === 0) return;
      const row = this.toRow(this.toRawRow(pending));
      if (row) rows.push(row);
      pending = [];
    };

    for (const line of text.split('\n')) {
      if (!line.trim()) continue;

      const columns = this.splitColumns(line);

      if (!DATE_START.test(columns[0] ?? '')) {
        // The tail of the row above, carrying the rest of its description and
        // whatever columns wrapped with it
        pending.push(...columns);
        continue;
      }

      flush();
      pending = columns;
    }

    flush();

    this.logger.log(`Read ${rows.length} statement rows`);
    return rows;
  }

  private splitColumns(line: string): string[] {
    return line
      .split(/\t|\s{2,}/)
      .map((column) => column.trim())
      .filter((column) => column.length > 0);
  }

  /**
   * Which column is which.
   *
   * The row ends in the amount and the running balance the account was left
   * at, with the user's own mark after them when they put one. Reading the
   * amount by counting from the left would hand back the balance the moment a
   * description wraps onto a second line.
   */
  private toRawRow(columns: string[]): RawRow {
    let last = columns.length - 1;
    let marker = '';

    if (last > 0 && !this.isFigure(columns[last])) {
      marker = columns[last];
      last -= 1;
    }

    // Two figures at the end means the second one is the balance
    const amountIndex =
      last > 0 && this.isFigure(columns[last]) && this.isFigure(columns[last - 1])
        ? last - 1
        : last;

    const hasReference = /^\d+$/.test(columns[1] ?? '') && amountIndex > 1;
    const descriptionFrom = hasReference ? 2 : 1;

    return {
      date: columns[0] ?? '',
      reference: hasReference ? columns[1] : '',
      description: columns.slice(descriptionFrom, amountIndex).join(' '),
      amountText: columns[amountIndex] ?? '',
      marker,
    };
  }

  /** True when the column holds a written figure rather than text. */
  private isFigure(column: string): boolean {
    return /^[+-]?[\d.,]+$/.test(column) && parseWrittenAmount(column) !== null;
  }

  private toRow(raw: RawRow): StatementRow | null {
    if (IGNORE_MARKER.test(raw.marker)) {
      this.logger.log(`Skipping row marked out: ${raw.date} ${raw.description}`);
      return null;
    }

    const amount = parseWrittenAmount(raw.amountText);
    const date = this.parseDate(raw.date);

    if (amount === null || amount === 0 || !date) {
      this.logger.warn(`Skipping row "${raw.date} ${raw.description} ${raw.amountText}"`);
      return null;
    }

    return {
      date,
      reference: raw.reference.replace(/\D/g, ''),
      description: raw.description.trim(),
      amount,
    };
  }

  /**
   * The statement writes its dates as the bank does, month first. A day past
   * the twelfth settles the order on its own.
   */
  private parseDate(text: string): Date | null {
    const match = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (!match) return null;

    const [, first, second, yearText] = match;
    let month = Number(first);
    let day = Number(second);

    if (month > 12 && day <= 12) {
      [month, day] = [day, month];
    }

    const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    // Caracas noon, so the day survives any timezone shift either way
    return new Date(Date.UTC(year, month - 1, day, 16, 0, 0));
  }
}
