import type { DateConventions, DatePart } from '../../utilities/formatting';
import type { Mask } from '../maskedInput/useMaskedInput';

// The date input's mask (K9, OQ-190). The date is typed in the interface
// language's order (`dd/mm/aaaa`, `mm/dd/yyyy`) and the separators appear on
// their own. A `/`, `.` or `-` typed after a single digit closes that piece
// with a zero in front, so `1/9/2026` reads as `01/09/2026`. The clean value
// is the digits in the order typed; the caller gets the contract's
// `YYYY-MM-DD`, or, while the date is incomplete, the pieces typed in that
// order (`--1`), which the ValidationUtility's `isoDate` rule reports as a
// malformed date.

/** How many digits each piece of a date takes. */
export const PART_DIGITS: Record<DatePart, number> = { day: 2, month: 2, year: 4 };

/** The most digits a date takes: day, month and a four-digit year. */
const DATE_DIGITS = 8;

/** The contract's calendar date, `YYYY-MM-DD`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What may be typed to close a piece early, whatever the locale writes. */
const PIECE_CLOSERS = /[/.-]/;

/** One piece of the date and where its digits start in the clean value. */
export interface DatePiece {
  readonly part: DatePart;
  readonly start: number;
}

/** Where a date's pieces sit in the clean value, and how they are written. */
export interface DateLayout {
  /** The pieces in the order written. */
  readonly pieces: readonly DatePiece[];
  /** What is shown between pieces, e.g. `/`. */
  readonly separator: string;
}

/**
 * Lays the date's pieces out in the clean value, in the locale's order.
 *
 * @param conventions - The locale's piece order and separator.
 * @returns Each piece with the position its digits start at, and the separator.
 */
export const dateLayout = ({ order, separator }: DateConventions): DateLayout => ({
  pieces: order.map((part, index) => ({
    part,
    start: order.slice(0, index).reduce((digits, before) => digits + PART_DIGITS[before], 0),
  })),
  separator,
});

/**
 * Reads one typed character onto the clean value: a digit is added while the
 * date has room, and a piece closer typed after a day's or month's single
 * digit puts a zero in front of it. Anything else is dropped.
 *
 * @param clean - The digits read so far.
 * @param character - The character typed.
 * @param layout - Where the pieces sit.
 * @returns The digits after the character.
 */
export const readDateCharacter = (
  clean: string,
  character: string,
  layout: DateLayout,
): string => {
  if (/\d/.test(character)) {
    return clean.length < DATE_DIGITS ? clean + character : clean;
  }
  const padsPiece = layout.pieces.some(({ part, start }) => (
    part !== 'year' && clean.length === start + 1
  ));
  if (PIECE_CLOSERS.test(character) && padsPiece) {
    return `${clean.slice(0, -1)}0${clean.slice(-1)}`;
  }
  return clean;
};

/**
 * Writes the clean digits with the separator before each piece after the
 * first that has begun; no separator trails.
 *
 * @param clean - The digits typed.
 * @param layout - Where the pieces sit.
 * @returns E.g. `14/09/2026`, `14/0`.
 */
export const formatDateDigits = (clean: string, layout: DateLayout): string => (
  [...clean]
    .map((digit, index) => (
      index > 0 && layout.pieces.some(({ start }) => start === index)
        ? `${layout.separator}${digit}`
        : digit
    ))
    .join('')
);

/**
 * Builds the date input's mask for a layout.
 *
 * @param layout - Where the pieces sit, and the separator.
 * @returns The mask: digits and separators on screen, digits as the clean value.
 */
export const dateMask = (layout: DateLayout): Mask => ({
  format: (clean) => formatDateDigits(clean, layout),
  parse: (text) => [...text].reduce(
    (clean, character) => readDateCharacter(clean, character, layout),
    '',
  ),
});

/**
 * Turns the clean digits into the caller's value.
 *
 * @param clean - The digits typed.
 * @param layout - Where the pieces sit.
 * @returns `''` when empty; otherwise `year-month-day` with each piece as far
 *   as typed: `YYYY-MM-DD` once complete, e.g. `--1` before.
 */
export const cleanToValue = (clean: string, layout: DateLayout): string => {
  if (clean === '') {
    return '';
  }
  const typed = Object.fromEntries(layout.pieces.map(({ part, start }) => (
    [part, clean.slice(start, start + PART_DIGITS[part])]
  )));
  return `${String(typed.year)}-${String(typed.month)}-${String(typed.day)}`;
};

/**
 * Turns the caller's value into clean digits in the layout's order.
 *
 * @param value - A `YYYY-MM-DD` date, or anything else.
 * @param layout - Where the pieces sit.
 * @returns The digits, or `''` when the value isn't a `YYYY-MM-DD` date.
 */
export const valueToClean = (value: string, layout: DateLayout): string => {
  if (!ISO_DATE.test(value)) {
    return '';
  }
  const [year, month, day] = value.split('-');
  const byPart: Record<DatePart, string | undefined> = { year, month, day };
  return layout.pieces.map(({ part }) => String(byPart[part])).join('');
};

/**
 * Picks the digits to show: what was typed while it still reads as the
 * caller's value, otherwise the value's own digits (a value set from outside).
 *
 * @param draft - The digits last typed.
 * @param value - The caller's value.
 * @param layout - Where the pieces sit.
 * @returns The clean digits to show.
 */
export const cleanToShow = (draft: string, value: string, layout: DateLayout): string => (
  cleanToValue(draft, layout) === value ? draft : valueToClean(value, layout)
);

/**
 * Writes the format as a hint, e.g. `dd/mm/aaaa`.
 *
 * @param layout - The pieces' order and the separator.
 * @param letters - What stands for each piece in the interface language.
 * @returns The format, in the layout's order.
 */
export const datePlaceholder = (
  layout: DateLayout,
  letters: Record<DatePart, string>,
): string => layout.pieces.map(({ part }) => letters[part]).join(layout.separator);
