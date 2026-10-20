import type { Currency } from '@financas/api-types';
import type { Locale } from '@financas/i18n';
import { formatting } from '../config/constants';

// FormattingUtility (FU6, EBD): turns the API's wire values into text with
// `Intl` (NFR-I18N-2). Money arrives in minor units and is written in its
// own currency's conventions whatever the interface language — a BRL amount
// reads `R$ 1.234,56` for an en-US user too. Rates arrive as percent ×
// 10,000 (OQ-86), whole percents as they are, dates as `YYYY-MM-DD`; those
// follow the interface language. A negative number takes the true minus
// sign (−), as the design does. Formatters are built once per locale and
// options, since `Intl` constructors are costly.

/** A rate's fixed-point scale on the wire: 10.50% is 105000 (OQ-86). */
const RATE_SCALE = 10_000;

/** A way of writing a calendar date (`formatting.dateStyles`). */
export type DateStyle = keyof typeof formatting.dateStyles;

/** How a money amount shows its sign. */
export interface MoneyOptions {
  /** `always` writes `+` on a positive amount (income); `auto` only `−` on a negative one. */
  readonly sign?: 'auto' | 'always';
}

/** How a currency writes its amounts: what a money input needs to mask them (K7). */
export interface MoneyConventions {
  /** E.g. `R$`, `$`. */
  readonly symbol: string;
  /** E.g. `,` for BRL, `.` for USD. */
  readonly decimal: string;
  /** The thousands separator, e.g. `.` for BRL, `,` for USD. */
  readonly group: string;
  /** The digits after the decimal separator: 2 for cents. */
  readonly minorDigits: number;
}

/** The formatters bound to one interface locale; money needs none. */
export interface Formatter {
  readonly money: (amount: number, currency: Currency, options?: MoneyOptions) => string;
  readonly rate: (rate: number) => string;
  readonly percent: (percent: number) => string;
  readonly date: (isoDate: string, style?: DateStyle) => string;
  readonly list: (items: readonly string[]) => string;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const listFormats = new Map<string, Intl.ListFormat>();

/**
 * Returns the cached value for a key, building and caching it on a miss.
 *
 * @param cache - Where built values are kept.
 * @param key - The value's identity.
 * @param build - Builds the value on a miss.
 * @returns The cached or newly built value.
 */
const cached = <Value>(cache: Map<string, Value>, key: string, build: () => Value): Value => {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const built = build();
  cache.set(key, built);
  return built;
};

/**
 * A number formatter for a locale and options, built once.
 *
 * @param locale - The BCP 47 locale.
 * @param options - The `Intl.NumberFormat` options.
 * @returns The formatter.
 */
const numberFormat = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => (
  cached(
    numberFormats,
    `${locale}|${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(locale, options),
  )
);

/**
 * Swaps the ASCII hyphen `Intl` writes for a negative number with the true minus sign.
 *
 * @param text - Formatted number text.
 * @returns The text with `−` in place of `-`.
 */
const withMinusSign = (text: string): string => text.replace('-', '−');

/**
 * Writes an amount of money in its own currency's conventions (NFR-I18N-2).
 *
 * @param amount - The amount in the currency's minor units (cents), as the API sends it.
 * @param currency - The amount's currency.
 * @param options - How the sign shows.
 * @returns E.g. `R$ 1.234,56`, `$1,234.56`, `+$3,200.00`, `−$45.99`.
 */
export const formatMoney = (
  amount: number,
  currency: Currency,
  options: MoneyOptions = {},
): string => {
  const format = numberFormat(formatting.currencyLocale[currency], {
    style: 'currency',
    currency,
    signDisplay: options.sign === 'always' ? 'exceptZero' : 'auto',
  });
  // Always set for a currency format; the lib types it as optional.
  const minorDigits = Number(format.resolvedOptions().maximumFractionDigits);
  return withMinusSign(format.format(amount / 10 ** minorDigits));
};

/**
 * Reads how a currency writes its amounts, in its own conventions (like
 * `formatMoney`), so a money input can mask them as they are typed.
 *
 * @param currency - The currency.
 * @returns Its symbol, decimal and thousands separators and minor digits.
 */
export const moneyConventions = (currency: Currency): MoneyConventions => {
  const format = numberFormat(formatting.currencyLocale[currency], { style: 'currency', currency });
  const parts = Object.fromEntries(
    format.formatToParts(1234.5).map(({ type, value }) => [type, value]),
  );
  // A currency format of 1234.5 always writes these three parts.
  return {
    symbol: String(parts.currency),
    decimal: String(parts.decimal),
    group: String(parts.group),
    // Always set for a currency format; the lib types it as optional.
    minorDigits: Number(format.resolvedOptions().maximumFractionDigits),
  };
};

/**
 * Writes a rate in the interface language.
 *
 * @param rate - Percent × 10,000, as the API sends it (105000 is 10.50%).
 * @param locale - The interface locale.
 * @returns E.g. `10.50%` (en-US), `10,50%` (pt-BR).
 */
export const formatRate = (rate: number, locale: Locale): string => {
  const format = numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: formatting.rateFractionDigits,
    maximumFractionDigits: formatting.rateFractionDigits,
  });
  return withMinusSign(format.format(rate / RATE_SCALE / 100));
};

/**
 * Writes a whole percent (a Goal allocation, OQ-87) in the interface language.
 *
 * @param percent - The percent, e.g. 40.
 * @param locale - The interface locale.
 * @returns E.g. `40%`.
 */
export const formatPercent = (percent: number, locale: Locale): string => (
  withMinusSign(numberFormat(locale, { style: 'percent' }).format(percent / 100))
);

/**
 * Writes a calendar date in the interface language. The date is read as a
 * day, not an instant, so no time zone moves it to the day before.
 *
 * @param isoDate - The date as the API sends it, `YYYY-MM-DD`.
 * @param locale - The interface locale.
 * @param style - How the date is written; `numeric` by default.
 * @returns E.g. `30/09/2026` (pt-BR), `09/30/2026` (en-US); the input itself when it isn't a date.
 */
export const formatDate = (
  isoDate: string,
  locale: Locale,
  style: DateStyle = 'numeric',
): string => {
  const day = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return isoDate;
  const format = cached(dateFormats, `${locale}|${style}`, () => (
    new Intl.DateTimeFormat(locale, { ...formatting.dateStyles[style], timeZone: 'UTC' })
  ));
  return format.format(day);
};

/**
 * Joins names into one phrase in the interface language.
 *
 * @param items - The names, in the order to show them.
 * @param locale - The interface locale.
 * @returns E.g. `A, B, and C` (en-US), `A, B e C` (pt-BR).
 */
export const formatList = (items: readonly string[], locale: Locale): string => {
  const format = cached(listFormats, locale, () => (
    new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
  ));
  return format.format(items);
};

/**
 * Binds the formatters to one interface locale.
 *
 * @param locale - The interface locale.
 * @returns The bound formatters.
 */
export const createFormatter = (locale: Locale): Formatter => ({
  money: formatMoney,
  rate: (rate) => formatRate(rate, locale),
  percent: (percent) => formatPercent(percent, locale),
  date: (isoDate, style) => formatDate(isoDate, locale, style),
  list: (items) => formatList(items, locale),
});
