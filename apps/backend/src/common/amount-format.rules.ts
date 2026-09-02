/**
 * How to read a written amount, shared by every prompt that has to pull a number
 * out of free text or OCR.
 *
 * Venezuelan and English conventions are both in daily use and get mixed, so the
 * separators alone never say which is which. What settles it is that a money
 * amount never carries more than two decimals: a separator followed by exactly
 * three digits is therefore always a thousands separator.
 */
export const AMOUNT_FORMAT_RULES = `Number format — Venezuelan and English conventions are mixed freely, so read the separators by these rules, in order:

1. A money amount NEVER has more than two decimals. A separator followed by exactly three digits is therefore a THOUSANDS separator, never a decimal point. "1,234" is 1234. "1.234" is 1234.
2. If BOTH "." and "," appear, the RIGHTMOST one is the decimal separator and the other groups thousands. "27,837.82" is 27837.82. "27.837,82" is 27837.82.
3. A single separator followed by one or two digits is a DECIMAL separator. "18,68" is 18.68. "18.68" is 18.68. "18,6" is 18.6.
4. The same separator repeated groups thousands. "1.234.567" is 1234567.

Never drop cents: if the text carries a decimal part, it must survive into the number you return.`;

/**
 * How the currency is written varies as much as the number: symbols, casing,
 * abbreviations and Spanish slang all show up.
 */
export const CURRENCY_FORMAT_RULES = `Currency — match it however it is written, in any casing, before or after the number, attached or spaced:

- USD: "$", "USD", "usd", "USd", "US", "us$", "dolares", "dólares", "dolar", "verdes"
- VES: "Bs", "bs", "BS", "Bs.", "VES", "ves", "bolivares", "bolívares", "bolos"
- EUR: "€", "EUR", "eur", "euros", "euro"

Return null for the currency only when the text names none.`;
