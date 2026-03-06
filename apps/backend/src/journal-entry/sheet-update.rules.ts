export interface SheetUpdateCell {
  cell: string;
}

export interface SheetUpdateRule {
  name: string;
  keywords: string[];
  exactMatch: boolean;
  sheet: string;
  cells: SheetUpdateCell[];
}

export const SHEET_UPDATE_RULES: SheetUpdateRule[] = [
  {
    name: 'saldo',
    keywords: ['saldo'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F6' }],
  },
  {
    name: 'gym',
    keywords: ['gym'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F8' }],
  },
  {
    name: 'internet',
    keywords: ['internet'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F20' }],
  },
  {
    name: 'neyda',
    keywords: ['neyda'],
    exactMatch: true,
    sheet: 'Libro',
    cells: [{ cell: 'G13' }, { cell: 'G17' }],
  },
];
