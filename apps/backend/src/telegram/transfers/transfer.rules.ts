export interface TransferRule {
  name: string;
  debitAccount: string;
  creditAccount: string;
  sheet: string;
  cell: string;
}

export const TRANSFER_RULES: TransferRule[] = [
  {
    name: 'EVO25',
    debitAccount: 'EVO25',
    creditAccount: 'Bofa TDC',
    sheet: 'Libro',
    cell: 'F44',
  },
  {
    name: 'Pago TDC',
    debitAccount: 'Bofa TDC',
    creditAccount: 'Bofa',
    sheet: 'Libro',
    cell: 'F18',
  },
];
