/**
 * Reading a written money amount, by the same rules the prompts state.
 *
 * Venezuelan and English conventions are mixed freely — "27.837,82" and
 * "27,837.82" are the same figure — so the separators alone never say which is
 * which. What settles it is that a money amount never carries more than two
 * decimals: a separator followed by exactly three digits is grouping thousands.
 *
 * This is the code twin of AMOUNT_FORMAT_RULES, for text that arrives in a
 * fixed shape and must not depend on an LLM to be read.
 */

/** The figure a written amount names, sign included, or null when it is not one. */
export function parseWrittenAmount(text: string): number | null {
  const cleaned = String(text ?? '')
    .replace(/[^\d.,+-]/g, '')
    .trim();

  if (!cleaned) return null;

  const negative = cleaned.startsWith('-');
  const digits = cleaned.replace(/^[+-]/, '');
  if (!/^\d[\d.,]*$/.test(digits)) return null;

  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  const decimalPosition = Math.max(lastDot, lastComma);

  let whole = digits;
  let fraction = '';

  if (decimalPosition !== -1) {
    const tail = digits.slice(decimalPosition + 1);
    const bothPresent = lastDot !== -1 && lastComma !== -1;

    // Three digits after the only separator is a thousands group: "1.234" is 1234
    const isDecimal = bothPresent || (tail.length > 0 && tail.length <= 2);

    if (isDecimal) {
      whole = digits.slice(0, decimalPosition);
      fraction = tail;
    }
  }

  const value = Number(`${whole.replace(/[.,]/g, '')}.${fraction || '0'}`);
  if (isNaN(value)) return null;

  return negative ? -value : value;
}
