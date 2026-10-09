export interface TransferRule {
  name: string;
  debitAccount: string;
  creditAccount: string;
  sheet: string;
  /**
   * The description in column C that marks the row to write into.
   *
   * The row is found by this text rather than by number, because the monthly
   * template moves rows around: EVO25 sat on row 44 in August and on row 40 in
   * October, so a hardcoded cell had been writing onto the Folionet row.
   */
  description: string;
  /** Column holding the amount on that row. */
  column: string;
}

export const TRANSFER_RULES: TransferRule[] = [
  {
    name: 'EVO25',
    debitAccount: 'EVO25',
    creditAccount: 'Bofa TDC',
    sheet: 'Libro',
    description: 'EVO25',
    column: 'F',
  },
  {
    name: 'Pago TDC',
    debitAccount: 'Bofa TDC',
    creditAccount: 'Bofa',
    sheet: 'Libro',
    description: 'Bofa → Bofa TDC',
    column: 'F',
  },
];
