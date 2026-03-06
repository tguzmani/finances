export class JournalEntryBuilder {
  private rows: string[][] = [];
  private startRow: number;

  constructor(startRow: number) {
    this.startRow = startRow;
  }

  addDebitRow(params: {
    date: string;
    description: string;
    account: string;
    category?: string;
    subcategory?: string;
  }): this {
    this.rows.push([
      params.date,
      params.description,
      params.account,
      '',
      '', // Debe formula - set in build()
      '',
      params.category || '',
      params.subcategory || '',
      '',
      '',
    ]);
    return this;
  }

  addCreditRow(params: { account: string; value: string }): this {
    this.rows.push([
      '', '', '',
      params.account,
      '',
      params.value,
      '', '', '', '',
    ]);
    return this;
  }

  build(): { rows: string[][]; range: string } {
    // Set Debe formula on debit row(s) to reference the last credit row's Haber (column G)
    const lastRowNumber = this.startRow + this.rows.length - 1;
    for (const row of this.rows) {
      // Debit rows have a value in column D (index 2) and empty Debe formula (index 4)
      if (row[2] && !row[4]) {
        row[4] = `=G${lastRowNumber}`;
      }
    }

    return {
      rows: this.rows,
      range: `Libro!B${this.startRow}:K${lastRowNumber}`,
    };
  }
}
