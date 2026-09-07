/**
 * Matching descriptions against rule keywords.
 *
 * This used to be fuzzy (Fuse.js, threshold 0.4), which scored a short
 * description highly against any keyword that contained it: "Te" matched
 * "internet" at 0.020 and "corte cabello" at 0.004, so a cup of tea was booked
 * onto the internet budget. Short descriptions are exactly what the bot gets,
 * so the matching is exact now — case- and accent-insensitive, nothing more.
 *
 * A description that matches nothing stays REVIEWED for a human to place, which
 * costs one tap. A description matched to the wrong rule writes into someone
 * else's budget line and credits the wrong account.
 */

/** Lowercases, strips accents and trims, so "Jardín" and "jardin" compare equal. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * True when the description contains any of the keywords.
 *
 * Keywords here are alternate spellings of one thing ("jardin", "jardín"), so a
 * single hit is a match.
 */
export function containsAnyKeyword(description: string, keywords: string[]): boolean {
  const folded = fold(description);
  return keywords.some((keyword) => folded.includes(fold(keyword)));
}

/**
 * True when the description contains every keyword.
 *
 * Keywords here name the parts of one description ("gasolina" + "lancer"), so
 * all of them have to be present.
 */
export function containsAllKeywords(description: string, keywords: string[]): boolean {
  const folded = fold(description);
  return keywords.every((keyword) => folded.includes(fold(keyword)));
}

/** True when the description is exactly one of the keywords. */
export function equalsAnyKeyword(description: string, keywords: string[]): boolean {
  const folded = fold(description);
  return keywords.some((keyword) => folded === fold(keyword));
}
