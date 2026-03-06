export interface AutoRegistrationRule {
  name: string;
  keywords: string[]; // Keywords for simple pre-filtering
  patterns: string[]; // Full description patterns for LLM matching
  debitAccount: string;
  category: string;
  subcategory: string;
}

export const AUTO_REGISTRATION_RULES: AutoRegistrationRule[] = [
  {
    name: 'gasolina_lancer',
    keywords: ['gasolina', 'lancer'],
    patterns: ['Gasolina Lancer'],
    debitAccount: 'Gastos gasolina',
    category: 'Carro',
    subcategory: 'Gasolina',
  },
  {
    name: 'gasolina_signo',
    keywords: ['gasolina', 'signo'],
    patterns: ['Gasolina Signo'],
    debitAccount: 'Gastos gasolina',
    category: 'Carro',
    subcategory: 'Gasolina',
  },
  {
    name: 'corte_cabello',
    keywords: ['corte', 'cabello'],
    patterns: ['Corte de Cabello'],
    debitAccount: 'Gastos mixtos',
    category: 'Otros',
    subcategory: 'Otros',
  },
  {
    name: 'neyda_adelanto',
    keywords: ['neyda', 'adelanto'],
    patterns: ['Neyda Adelanto'],
    debitAccount: 'Gastos casa',
    category: 'Casa',
    subcategory: 'Neyda',
  },
];
