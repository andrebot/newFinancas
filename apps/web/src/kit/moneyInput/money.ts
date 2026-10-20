import type { MoneyConventions } from '../../utilities/formatting';
import type { Mask } from '../maskedInput/useMaskedInput';

// The money input's mask (K7, OQ-188). Digits fill from the right, cents
// first, as in Brazilian bank apps: typing 1, 2, 3 shows 0,01, 0,12, 1,23.
// There is no decimal key, so nothing depends on whether the currency writes
// `,` or `.`. The text follows the currency's own conventions, like every
// amount on screen (FU6). The clean value is the minor units as text, with a
// leading `-` when negative; every minus typed flips the sign, so `-`
// anywhere toggles it.

/** The true minus sign, as the design writes negatives. */
const MINUS = '−';

/**
 * Puts the thousands separator between each group of three digits, from the right.
 *
 * @param digits - The whole part's digits.
 * @param group - The currency's thousands separator.
 * @returns E.g. `1.234.567`.
 */
export const groupThousands = (digits: string, group: string): string => (
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, group)
);

/**
 * Writes a clean value as the input shows it: whole part grouped, the minor
 * digits after the decimal separator, and a minus sign when negative.
 *
 * @param clean - Minor units as text, e.g. `-123456`; empty for no amount.
 * @param conventions - The currency's separators and minor digits.
 * @returns E.g. `−1.234,56` (BRL), `0.05` (USD); empty for no amount.
 */
export const formatMoneyDigits = (clean: string, conventions: MoneyConventions): string => {
  if (clean === '') {
    return '';
  }
  const sign = clean.startsWith('-') ? MINUS : '';
  const digits = clean.replace(/-/g, '').padStart(conventions.minorDigits + 1, '0');
  const split = digits.length - conventions.minorDigits;
  const whole = groupThousands(digits.slice(0, split), conventions.group);
  const minor = digits.slice(split);
  return `${sign}${whole}${minor && conventions.decimal}${minor}`;
};

/**
 * Turns typed text into a clean value: its digits, and each minus sign as
 * `-` when the amount may be negative. Separators, the symbol and letters
 * are dropped.
 *
 * @param text - What the user typed or pasted.
 * @param allowNegative - Whether a minus sign is kept.
 * @returns The digits, with any minus signs where they were typed.
 */
export const parseMoneyText = (text: string, allowNegative: boolean): string => {
  const kept = allowNegative ? /[^\d\-−]/g : /\D/g;
  return text.replace(kept, '').replace(/−/g, '-');
};

/**
 * Builds the money mask for a currency: its text fills from the right, so the
 * caret is counted from the end.
 *
 * @param conventions - The currency's separators and minor digits.
 * @param allowNegative - Whether a minus sign may be typed.
 * @returns The mask for `useMaskedInput`.
 */
export const moneyMask = (conventions: MoneyConventions, allowNegative: boolean): Mask => ({
  format: (clean) => formatMoneyDigits(clean, conventions),
  parse: (text) => parseMoneyText(text, allowNegative),
  anchor: 'end',
});

/**
 * Writes an amount as the mask's clean value.
 *
 * @param amount - Minor units, or `null` for no amount.
 * @returns E.g. `-123456`; empty for no amount.
 */
export const amountToClean = (amount: number | null): string => (
  amount === null ? '' : String(amount)
);

/**
 * Tells whether a clean value has more significant digits than an amount may.
 *
 * @param clean - The value parsed from the text typed.
 * @param maxDigits - The most digits allowed, cents included.
 * @returns `true` when the edit must be refused.
 */
export const exceedsMaxDigits = (clean: string, maxDigits: number): boolean => (
  clean.replace(/\D/g, '').replace(/^0+/, '').length > maxDigits
);

/**
 * Reads the amount a clean value holds. Every minus sign flips the sign, so a
 * minus typed on a negative amount makes it positive again. Without a
 * significant digit there is no amount: deleting down past `0,01` empties
 * the input, and the placeholder shows the zero.
 *
 * @param clean - The value parsed from the text typed, e.g. `-0012`.
 * @returns The minor units, e.g. `-12`, or `null` when no digit but zeros is left.
 */
export const readAmount = (clean: string): number | null => {
  const digits = clean.replace(/-/g, '').replace(/^0+/, '');
  if (digits === '') {
    return null;
  }
  const negative = (clean.match(/-/g) ?? []).length % 2 === 1;
  return negative ? -Number(digits) : Number(digits);
};
