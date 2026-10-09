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

/**
 * Writes are always additive: a second match adds to whatever the cell holds
 * instead of replacing it. Replacing silently destroyed budget figures that had
 * been typed by hand.
 */
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
    exactMatch: true,
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
  {
    name: 'devsignal_income',
    keywords: ['devsignal', 'trybe'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F26' }],
  },
  {
    name: 'jardin',
    keywords: ['jardin', 'jardín'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'G25' }],
  },
  {
    name: 'codebay_income',
    keywords: ['codebay'],
    exactMatch: true,
    sheet: 'Libro',
    cells: [{ cell: 'F28' }, { cell: 'F32' }],
  },
];
