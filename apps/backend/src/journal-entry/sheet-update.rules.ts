/** Where on the Libro a rule writes its amount. */
export interface SheetUpdateTarget {
  /**
   * Block title in column C. The row is looked up by this text rather than
   * stored as a number, because the monthly template moves rows around and a
   * stale number writes the amount onto somebody else's entry.
   */
  description: string;
  /** Column holding the amount: F for a Debe, G for a Haber. */
  column: 'F' | 'G';
  /** Rows below the block title where the amount sits. Defaults to 0. */
  offset?: number;
}

export interface SheetUpdateRule {
  name: string;
  keywords: string[];
  exactMatch: boolean;
  sheet: string;
  /** Tried in order; the first one still empty takes the amount. */
  targets: SheetUpdateTarget[];
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
    targets: [{ description: 'Saldo', column: 'F' }],
  },
  {
    name: 'gym',
    keywords: ['gym'],
    exactMatch: true,
    sheet: 'Libro',
    targets: [{ description: 'Membresia Gimnasio', column: 'F' }],
  },
  {
    name: 'internet',
    keywords: ['internet'],
    exactMatch: false,
    sheet: 'Libro',
    targets: [{ description: 'Pago Internet', column: 'F' }],
  },
  {
    name: 'neyda',
    keywords: ['neyda'],
    exactMatch: true,
    sheet: 'Libro',
    targets: [
      { description: 'Pago 1/2 Neyda', column: 'G', offset: 3 },
      { description: 'Pago 2/2 Neyda', column: 'G', offset: 3 },
    ],
  },
  {
    name: 'devsignal_income',
    keywords: ['devsignal', 'trybe'],
    exactMatch: false,
    sheet: 'Libro',
    targets: [{ description: 'Pago 1/1 Trybe', column: 'F' }],
  },
  {
    name: 'jardin',
    keywords: ['jardin', 'jardín'],
    exactMatch: false,
    sheet: 'Libro',
    targets: [{ description: 'Recurrentes casa', column: 'G', offset: 3 }],
  },
  {
    name: 'codebay_income',
    keywords: ['codebay'],
    exactMatch: true,
    sheet: 'Libro',
    targets: [
      { description: 'Pago 1/2 Talkive', column: 'F' },
      { description: 'Pago 2/2 Talkive', column: 'F' },
    ],
  },
];
