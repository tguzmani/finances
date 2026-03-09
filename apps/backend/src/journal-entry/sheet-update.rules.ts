export interface SheetUpdateCell {
  cell: string;
}

export interface SheetUpdateRule {
  name: string;
  keywords: string[];
  exactMatch: boolean;
  sheet: string;
  cells: SheetUpdateCell[];
  accumulate?: boolean;
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
  {
    name: 'cursor_subscription',
    keywords: ['cursor'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
    accumulate: true,
  },
  {
    name: 'google_play_subscription',
    keywords: ['google play'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
    accumulate: true,
  },
  {
    name: 'claude_subscription',
    keywords: ['claude'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
    accumulate: true,
  },
  {
    name: 'anthropic_subscription',
    keywords: ['anthropic'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
    accumulate: true,
  },
  {
    name: 'render_subscription',
    keywords: ['render'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F4' }],
    accumulate: true,
  },
  {
    name: 'onemeta_income',
    keywords: ['onemeta'],
    exactMatch: false,
    sheet: 'Libro',
    cells: [{ cell: 'F26' }, { cell: 'F30' }],
  },
  {
    name: 'codebay_income',
    keywords: ['codebay'],
    exactMatch: true,
    sheet: 'Libro',
    cells: [{ cell: 'F28' }, { cell: 'F32' }],
  },
];
