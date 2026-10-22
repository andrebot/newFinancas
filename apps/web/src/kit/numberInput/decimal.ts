import type { Mask } from '../maskedInput/useMaskedInput';

// The number input's mask (K8, OQ-189). Unlike money, the decimal point is
// typed: `110`, `10,25`, `0,5`. Either `,` or `.` places it, since a phone's
// keypad may offer only one, and only the first counts; there is no
// thousands grouping, so neither key is ambiguous. The text shows the
// interface language's decimal sign. The clean value is the number as typed,
// with `.` for the point and a leading `-` when negative; the caller gets it
// as the API's fixed-point integer.

/** The kinds of number the input takes. */
export type NumberKind = 'quantity' | 'rate' | 'percent' | 'exchange';

/**
 * The decimals each kind's integer carries on the wire: a Quantity is units ×
 * 10⁸ (8 decimals), a rate percent × 10,000 (OQ-86), a whole percent has
 * none (OQ-87). An exchange rate never reaches the wire (FR-9.1): it is × 10,000
 * too, a plain factor rather than a percent (OQ-195).
 */
export const KIND_SCALE: Record<NumberKind, number> = {
  quantity: 8, rate: 4, percent: 0, exchange: 4,
};

/** The true minus sign, as the design writes negatives. */
const MINUS = '−';

/** What one typed character becomes in the clean value, and whether it was the point. */
interface CleanCharacter {
  readonly kept: string;
  readonly point: boolean;
}

/**
 * Reads one typed character: a digit stays, a minus sign stays when the number
 * may be negative, and the first `,` or `.` becomes the point when the kind
 * has decimals. Anything else is dropped.
 *
 * @param character - The character typed.
 * @param pointAllowed - Whether a point may still be placed.
 * @param allowNegative - Whether a minus sign is kept.
 * @returns What the character becomes, and whether it is the point.
 */
export const readCharacter = (
  character: string,
  pointAllowed: boolean,
  allowNegative: boolean,
): CleanCharacter => {
  if (/\d/.test(character)) {
    return { kept: character, point: false };
  }
  if (allowNegative && /[-−]/.test(character)) {
    return { kept: '-', point: false };
  }
  if (pointAllowed && /[.,]/.test(character)) {
    return { kept: '.', point: true };
  }
  return { kept: '', point: false };
};

/**
 * Turns typed text into a clean value, character by character, so a prefix
 * of the text parses to a prefix of the value.
 *
 * @param text - What the user typed or pasted.
 * @param scale - The kind's decimals; 0 takes no point.
 * @param allowNegative - Whether a minus sign is kept.
 * @returns The digits, at most one `.` and any minus signs where they were typed.
 */
export const parseDecimalText = (text: string, scale: number, allowNegative: boolean): string => (
  [...text].reduce((parsed, character) => {
    const { kept, point } = readCharacter(character, !parsed.pointPlaced, allowNegative);
    return { clean: parsed.clean + kept, pointPlaced: parsed.pointPlaced || point };
  }, { clean: '', pointPlaced: scale === 0 }).clean
);

/**
 * Writes a clean value as the input shows it: the interface language's
 * decimal sign for the point, and the true minus sign.
 *
 * @param clean - The normalized clean value, e.g. `-10.5`.
 * @param decimal - The interface language's decimal sign.
 * @returns E.g. `−10,5` (pt-BR).
 */
export const formatDecimalText = (clean: string, decimal: string): string => (
  clean.replace('-', MINUS).replace('.', decimal)
);

/**
 * Puts a clean value in its one form: every minus sign typed flips the sign,
 * which leads; leading zeros go, but one stays before the point.
 *
 * @param clean - The clean value of an edit, e.g. `010.5-`.
 * @returns E.g. `-10.5`.
 */
export const normalizeDecimal = (clean: string): string => {
  const negative = (clean.match(/-/g) ?? []).length % 2 === 1;
  const body = clean.replace(/-/g, '').replace(/^0+(?=\d)/, '');
  return negative ? `-${body}` : body;
};

/**
 * Splits a clean value into its whole and fraction digits, the sign dropped.
 *
 * @param clean - A clean value.
 * @returns The digits before and after the point.
 */
const splitDigits = (clean: string) => {
  const [whole = '', fraction = ''] = clean.replace(/-/g, '').split('.');
  return { whole, fraction };
};

/**
 * Tells whether a clean value has more digits than its kind takes.
 *
 * @param clean - The normalized clean value.
 * @param scale - The kind's decimals.
 * @param maxWholeDigits - The most significant digits before the point.
 * @returns `true` when the edit must be refused.
 */
export const exceedsDigits = (clean: string, scale: number, maxWholeDigits: number): boolean => {
  const { whole, fraction } = splitDigits(clean);
  return whole.replace(/^0+/, '').length > maxWholeDigits || fraction.length > scale;
};

/**
 * Reads the fixed-point integer a clean value holds. Without a digit there
 * is none; zero is never negative.
 *
 * @param clean - The normalized clean value, e.g. `-10.5`.
 * @param scale - The kind's decimals.
 * @returns E.g. `-105000` at scale 4, or `null` for `''`, `-` or `.`.
 */
export const readScaled = (clean: string, scale: number): number | null => {
  if (!/\d/.test(clean)) {
    return null;
  }
  const { whole, fraction } = splitDigits(clean);
  const magnitude = Number(`${whole}${fraction.padEnd(scale, '0')}`);
  return clean.startsWith('-') && magnitude !== 0 ? -magnitude : magnitude;
};

/**
 * Writes a fixed-point integer as a clean value, without trailing zeros.
 *
 * @param value - The integer, or `null` for no number.
 * @param scale - The kind's decimals.
 * @returns E.g. `10.5` for 105000 at scale 4; empty for no number.
 */
export const scaledToClean = (value: number | null, scale: number): string => {
  if (value === null) {
    return '';
  }
  const digits = String(Math.abs(value)).padStart(scale + 1, '0');
  const split = digits.length - scale;
  const fraction = digits.slice(split).replace(/0+$/, '');
  const sign = value < 0 ? '-' : '';
  return `${sign}${digits.slice(0, split)}${fraction && '.'}${fraction}`;
};

/**
 * Picks the clean value to show: what was typed while it still reads as the
 * caller's number (so `10,` keeps its comma), or else the caller's number.
 *
 * @param draft - The last clean value typed.
 * @param value - The caller's fixed-point integer, or `null`.
 * @param scale - The kind's decimals.
 * @returns The clean value for the mask.
 */
export const cleanToShow = (draft: string, value: number | null, scale: number): string => (
  readScaled(draft, scale) === value ? draft : scaledToClean(value, scale)
);

/**
 * Builds the number mask for a kind in the interface language.
 *
 * @param decimal - The interface language's decimal sign.
 * @param scale - The kind's decimals.
 * @param allowNegative - Whether a minus sign may be typed.
 * @returns The mask for `useMaskedInput`.
 */
export const decimalMask = (decimal: string, scale: number, allowNegative: boolean): Mask => ({
  format: (clean) => formatDecimalText(clean, decimal),
  parse: (text) => parseDecimalText(text, scale, allowNegative),
});
