export interface AutoRegistrationRule {
  name: string;
  /** All of these must appear in the description for the rule to match. */
  keywords: string[];
  debitAccount: string;
  category: string;
  subcategory: string;
}

export const AUTO_REGISTRATION_RULES: AutoRegistrationRule[] = [
  {
    name: 'gasolina_lancer',
    keywords: ['gasolina', 'lancer'],
    debitAccount: 'Gastos gasolina',
    category: 'Carro',
    subcategory: 'Gasolina',
  },
  {
    name: 'gasolina_signo',
    keywords: ['gasolina', 'signo'],
    debitAccount: 'Gastos gasolina',
    category: 'Carro',
    subcategory: 'Gasolina',
  },
  {
    name: 'corte_cabello',
    keywords: ['corte', 'cabello'],
    debitAccount: 'Gastos mixtos',
    category: 'Otros',
    subcategory: 'Otros',
  },
  {
    name: 'neyda_adelanto',
    keywords: ['neyda', 'adelanto'],
    debitAccount: 'Gastos casa',
    category: 'Casa',
    subcategory: 'Neyda',
  },
];
