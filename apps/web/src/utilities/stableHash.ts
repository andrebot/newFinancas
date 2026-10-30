// A string's stable hash: the same text lands on the same number on every
// screen and device, so a colour picked from it never moves — a member's
// avatar (K31) and an account's balance card (FL17) keep theirs.

/**
 * Hashes a text to a whole number (a 31-multiplier string hash).
 *
 * @param text - The text, e.g. a user's or an account's id.
 * @returns A non-negative 32-bit hash.
 */
export const stableHash = (text: string) => Array.from(text).reduce(
  (hash, character) => (hash * 31 + character.codePointAt(0)!) % (2 ** 32),
  0,
);

/**
 * Picks one of a list by a text's stable hash.
 *
 * @param text - The text, e.g. an id.
 * @param choices - The list to pick from; never empty.
 * @returns The choice the text always lands on.
 */
export const pickByHash = <Choice>(
  text: string,
  choices: readonly [Choice, ...Choice[]],
): Choice => (
  choices[stableHash(text) % choices.length]!
);
