export const JOURNAL_ACCOUNTS = [
  'Patrimonio', 'Binance', 'Wallet', 'Banesco', 'Cash', 'Folionet',
  'Inventario', 'Bofa', 'EVO25', 'Binance Portfolio',
  'Por cobrar mixtos', 'Por cobrar Akivva', 'Por cobrar Esther',
  'Por pagar Norma', 'Por pagar Esther', 'Bofa TDC',
  'Ingresos mixtos', 'Ingresos Devups', 'Ingresos Akivva',
  'Ingresos DevSignal', 'Ingresos Talkive',
  'Ingresos Physfit', 'Ingresos intereses',
  'Gastos wishlist', 'Gastos mercado', 'Gastos curda', 'Gastos weed', 'Gastos carne',
  'Gastos servicios', 'Gastos gasolina', 'Gastos delivery', 'Gastos casa',
  'Gastos medicinas', 'Gastos gimnasio', 'Gastos UCAB', 'Gastos mixtos',
  'Gastos cafeína', 'Gastos comisiones', 'Gastos Esther', 'Gastos restaurant',
];

/** What a transfer may move between. Kept derived so the classifier's prompt
 *  can never drift from the account list the way a hardcoded copy did. */
export const LIABILITY_ACCOUNTS = JOURNAL_ACCOUNTS.filter(
  (account) => account.startsWith('Por pagar') || account === 'Bofa TDC',
);

export const ASSET_ACCOUNTS = JOURNAL_ACCOUNTS.filter(
  (account) =>
    !account.startsWith('Ingresos') &&
    !account.startsWith('Gastos') &&
    account !== 'Patrimonio' &&
    !LIABILITY_ACCOUNTS.includes(account),
);

export const REAL_ACCOUNTS = JOURNAL_ACCOUNTS.filter(
  (account) => !account.startsWith('Ingresos') && !account.startsWith('Gastos'),
);
