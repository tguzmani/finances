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
    name: 'cursor_subscription',
    keywords: ['cursor'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
  },
  {
    name: 'google_play_subscription',
    keywords: ['google play'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
  },
  {
    name: 'claude_subscription',
    keywords: ['claude'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
  },
  {
    name: 'anthropic_subscription',
    keywords: ['anthropic'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
  },
  {
    name: 'render_subscription',
    keywords: ['render'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
  },
  {
    name: 'onemeta_income',
    keywords: ['onemeta'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F26' }, { cell: 'F30' }],
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
