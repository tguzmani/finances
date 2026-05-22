export const VENEZUELAN_BANKS: Record<string, string> = {
  '0001': 'Banco Central de Venezuela',
  '0003': 'Banco Industrial de Venezuela, C.A.',
  '0006': 'Banco Coro, C.A.',
  '0008': 'Banco Guayana, C.A.',
  '0102': 'Banco de Venezuela S.A.C.A. Banco Universal',
  '0104': 'Venezolano de Crédito, S.A. Banco Universal',
  '0105': 'Banco Mercantil, C.A. S.A.C.A. Banco Universal',
  '0108': 'Banco Provincial, S.A. Banco Universal',
  '0114': 'Banco del Caribe, C.A. Banco Universal',
  '0115': 'Banco Exterior, C.A. Banco Universal',
  '0116': 'Banco Occidental de Descuento Banco Universal, C.A. S.A.C.A',
  '0121': 'Corp Banca, C.A. Banco Universal',
  '0128': 'Banco Caroní, C.A. Banco Universal',
  '0133': 'Banco Federal, C.A.',
  '0134': 'Banesco Banco Universal S.A.C.A.',
  '0137': 'Banco Sofitasa Banco Universal, C.A.',
  '0138': 'Banco Plaza, C.A.',
  '0146': 'Banco de la Gente Emprendedora Bangente, C.A.',
  '0148': 'Total Bank, C.A. Banco Universal',
  '0151': 'BFC Banco Fondo Común C.A. Banco Universal',
  '0156': '100% Banco, Banco Comercial, C.A.',
  '0157': 'Del Sur Banco Universal, C.A.',
  '0162': 'Banvalor Banco Comercial, C.A.',
  '0163': 'Banco del Tesoro, C.A. Banco Universal',
  '0166': 'Banco Agrícola de Venezuela, C.A. Banco Universal',
  '0168': 'Bancrecer S.A. Banco de Desarrollo',
  '0169': 'Mi Banco, Banco de Desarrollo, C.A.',
  '0171': 'Banco Activo, C.A. Banco Comercial',
  '0173': 'Banco Internacional de Desarrollo, C.A.',
  '0174': 'Banplus Banco Comercial, C.A.',
  '0175': 'Banco Bicentenario Banco Universal, C.A.',
  '0190': 'Citibank N.A.',
  '0191': 'Banco Nacional Crédito, C.A. Banco Universal',
  '0194': 'Helm Bank de Venezuela, S.A. Banco Comercial Regional',
  '0196': 'ABN-AMRO Bank N.V.',
  '0410': 'Casa Propia E.A.P.',
  '0601': 'Instituto Municipal de Crédito Popular',
};

export function getBankName(code: string): string | null {
  return VENEZUELAN_BANKS[code] ?? null;
}

export function formatBankList(): string {
  return Object.entries(VENEZUELAN_BANKS)
    .map(([code, name]) => `${code}: ${name}`)
    .join('\n');
}
