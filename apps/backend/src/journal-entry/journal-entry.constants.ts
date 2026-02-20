export const JOURNAL_ACCOUNTS = [
  'Patrimonio', 'Binance', 'Wallet', 'Banesco', 'Cash', 'Folionet',
  'Inventario', 'Bofa', 'EVO25', 'Binance Portfolio',
  'Por cobrar OneMeta', 'Por cobrar mixtos', 'Por cobrar Akivva', 'Por cobrar Esther',
  'Por pagar Norma', 'Por pagar Esther', 'Bofa TDC',
  'Ingresos mixtos', 'Ingresos Devups', 'Ingresos OneMeta', 'Ingresos Akivva',
  'Ingresos Physfit', 'Ingresos intereses',
  'Gastos wishlist', 'Gastos mercado', 'Gastos curda', 'Gastos weed', 'Gastos carne',
  'Gastos servicios', 'Gastos gasolina', 'Gastos delivery', 'Gastos casa',
  'Gastos medicinas', 'Gastos gimnasio', 'Gastos UCAB', 'Gastos mixtos',
  'Gastos cafeína', 'Gastos comisiones', 'Gastos Esther', 'Gastos restaurant',
];

export const JOURNAL_CATEGORIES: Record<string, string[]> = {
  Esther:   ['Esther'],
  Comida:   ['Pescado', 'Carne', 'Mercado', 'Delivery', 'Local'],
  Carro:    ['Gasolina', 'Servicio'],
  Vicio:    ['Curda', 'Weed', 'Cafeína'],
  Servicio: ['Suscripciones', 'Internet', 'Gimnasio'],
  Otros:    ['Otros', 'Comisiones'],
  Salud:    ['Consultas', 'Medicinas'],
  UCAB:     ['Matrícula'],
  Wishlist: ['Wishlist'],
  Casa:     ['Neyda', 'Casa'],
};
