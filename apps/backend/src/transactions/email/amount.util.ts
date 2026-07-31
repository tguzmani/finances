/**
 * Parses a Venezuelan amount string into a number, handling both formats
 * found across bank and merchant emails:
 * - "20.703,03" (European: period = thousands, comma = decimal)
 * - "20703.03"  (US/VE: period = decimal)
 */
export function parseVesAmount(amountStr: string): number {
  if (amountStr.includes(',')) {
    // European format: remove periods (thousands), replace comma with period
    return parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
  }
  // US/VE format: period is already the decimal separator
  return parseFloat(amountStr);
}
