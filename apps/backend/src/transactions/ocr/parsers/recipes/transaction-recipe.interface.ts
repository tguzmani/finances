export interface TransactionRecipeResult {
  datetime: Date | null;
  amount: number | null;
  transactionId: string | null;
  currency?: string; // Optional - defaults to 'VES' if not provided
}

export interface TransactionRecipe {
  /**
   * Unique identifier for this recipe
   */
  name: string;

  /**
   * Quick check to see if this recipe can handle the text
   * Should be fast (e.g., keyword check)
   */
  canParse(text: string): boolean;

  /**
   * Extract transaction data from OCR text
   * Only called if canParse() returns true
   */
  parse(text: string): TransactionRecipeResult;

  /**
   * Check if the parsed result is valid (has all required fundamentals)
   */
  isValid(result: TransactionRecipeResult): boolean;
}
