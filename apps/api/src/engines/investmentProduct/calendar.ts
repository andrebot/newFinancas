// InvestmentProductEngine — the calendar (FR-11.2, OQ-201): plain date
// arithmetic on `YYYY-MM-DD` strings, Brazil's national holidays (coded here as
// reference data — a fixed list plus the Easter-based ones, computed), and
// business days per market. Dates are calendar days, read in UTC.

/** The market whose calendar and rules apply to an instrument (FR-11.1). */
export type Market = 'BR' | 'US';

/** A fixed-date national holiday; `since` is the first year it applies. */
interface FixedHoliday {
  readonly month: number;
  readonly day: number;
  readonly since?: number;
}

// Brazil's national holidays on a fixed date (Lei 662/1949 and later); Black
// Consciousness Day (Nov 20) since Lei 14.759/2023.
const FIXED_HOLIDAYS: readonly FixedHoliday[] = [
  { month: 1, day: 1 },
  { month: 4, day: 21 },
  { month: 5, day: 1 },
  { month: 9, day: 7 },
  { month: 10, day: 12 },
  { month: 11, day: 2 },
  { month: 11, day: 15 },
  { month: 11, day: 20, since: 2024 },
  { month: 12, day: 25 },
];

// Days from Easter Sunday of the bank holidays that move with it: Carnival
// Monday and Tuesday, Good Friday, Corpus Christi.
const EASTER_OFFSETS = [-48, -47, -2, 60] as const;

const MS_PER_DAY = 86_400_000;
const SATURDAY = 6;
const SUNDAY = 0;

/**
 * Reads a calendar date as midnight UTC.
 *
 * @param date - `YYYY-MM-DD`.
 * @returns The instant.
 */
const toInstant = (date: string): Date => new Date(`${date}T00:00:00Z`);

/**
 * Writes an instant's UTC calendar date.
 *
 * @param instant - The instant.
 * @returns `YYYY-MM-DD`.
 */
const toDate = (instant: Date): string => instant.toISOString().slice(0, 10);

/**
 * Builds a date from its parts.
 *
 * @param year - The year.
 * @param month - The month, 1–12.
 * @param day - The day of the month.
 * @returns `YYYY-MM-DD`.
 */
const dateOf = (year: number, month: number, day: number): string => (
  toDate(new Date(Date.UTC(year, month - 1, day)))
);

/**
 * Moves a date by some days.
 *
 * @param date - `YYYY-MM-DD`.
 * @param days - Days to add; negative goes back.
 * @returns `YYYY-MM-DD`.
 */
export const addDays = (date: string, days: number): string => (
  toDate(new Date(toInstant(date).getTime() + days * MS_PER_DAY))
);

/**
 * Counts the calendar days from one date to another.
 *
 * @param from - `YYYY-MM-DD`.
 * @param to - `YYYY-MM-DD`.
 * @returns `to − from` in days; negative when `to` is earlier.
 */
export const daysBetween = (from: string, to: string): number => (
  Math.round((toInstant(to).getTime() - toInstant(from).getTime()) / MS_PER_DAY)
);

/**
 * Moves a date back whole months, keeping its day of the month — capped at the
 * month's last day (Jan 31 one month back from Mar 31 is Feb 28/29).
 *
 * @param date - `YYYY-MM-DD`; its day is the anchor.
 * @param months - Months to go back.
 * @returns `YYYY-MM-DD`.
 */
export const monthsBefore = (date: string, months: number): string => {
  const instant = toInstant(date);
  const monthIndex = instant.getUTCFullYear() * 12 + instant.getUTCMonth() - months;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return dateOf(year, month, Math.min(instant.getUTCDate(), lastDay));
};

/**
 * Easter Sunday of a year in the Gregorian calendar (the anonymous algorithm,
 * Meeus/Jones/Butcher).
 *
 * @param year - The year.
 * @returns `YYYY-MM-DD`.
 */
export const easterSunday = (year: number): string => {
  const golden = year % 19;
  const century = Math.floor(year / 100);
  const yearOfCentury = year % 100;
  const leapCenturies = Math.floor(century / 4);
  const correction = Math.floor((century + 8) / 25);
  const moon = Math.floor((century - correction + 1) / 3);
  const epact = (19 * golden + century - leapCenturies - moon + 15) % 30;
  const weekday = (32 + 2 * (century % 4) + 2 * Math.floor(yearOfCentury / 4)
    - epact - (yearOfCentury % 4)) % 7;
  const shift = Math.floor((golden + 11 * epact + 22 * weekday) / 451);
  const monthDay = epact + weekday - 7 * shift + 114;
  return dateOf(year, Math.floor(monthDay / 31), (monthDay % 31) + 1);
};

/**
 * Brazil's national (bank) holidays of a year.
 *
 * @param year - The year.
 * @returns Their dates.
 */
export const brazilianHolidays = (year: number): Set<string> => {
  const easter = easterSunday(year);
  return new Set([
    ...FIXED_HOLIDAYS
      .filter((holiday) => (holiday.since ?? year) <= year)
      .map((holiday) => dateOf(year, holiday.month, holiday.day)),
    ...EASTER_OFFSETS.map((offset) => addDays(easter, offset)),
  ]);
};

/**
 * Tells whether a date is a weekday that isn't a holiday of the market (the US
 * has no coded holidays: weekends only).
 *
 * @param date - `YYYY-MM-DD`.
 * @param market - The market.
 * @param holidays - The market's holidays covering the date.
 * @returns `true` on a business day.
 */
const isBusinessDay = (date: string, market: Market, holidays: Set<string>): boolean => {
  const weekday = toInstant(date).getUTCDay();
  if (weekday === SATURDAY || weekday === SUNDAY) return false;
  return market === 'US' || !holidays.has(date);
};

/**
 * The holidays of a market over some years.
 *
 * @param market - The market.
 * @param fromYear - First year.
 * @param toYear - Last year, included.
 * @returns Their dates; none for the US.
 */
const holidaysOf = (market: Market, fromYear: number, toYear: number): Set<string> => {
  if (market === 'US') return new Set();
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, offset) => fromYear + offset);
  return new Set(years.flatMap((year) => [...brazilianHolidays(year)]));
};

/**
 * Reads a date's year.
 *
 * @param date - `YYYY-MM-DD`.
 * @returns The year.
 */
const yearOf = (date: string): number => Number(date.slice(0, 4));

/**
 * Counts business days from one date (included) to another (excluded) — the
 * days a Brazilian instrument accrues over (252 a year).
 *
 * @param from - `YYYY-MM-DD`.
 * @param to - `YYYY-MM-DD`.
 * @param market - The market.
 * @returns The count; 0 when `to` isn't after `from`.
 */
export const businessDaysBetween = (from: string, to: string, market: Market): number => {
  const holidays = holidaysOf(market, yearOf(from), yearOf(to));
  const length = Math.max(daysBetween(from, to), 0);
  return Array.from({ length }, (_, offset) => addDays(from, offset))
    .filter((date) => isBusinessDay(date, market, holidays)).length;
};

/**
 * The date a payment falls due: the date itself on a business day, otherwise
 * the following business day (OQ-205).
 *
 * @param date - The contract date, `YYYY-MM-DD`.
 * @param market - The market.
 * @returns `YYYY-MM-DD`.
 */
export const followingBusinessDay = (date: string, market: Market): string => (
  isBusinessDay(date, market, holidaysOf(market, yearOf(date), yearOf(date)))
    ? date
    : followingBusinessDay(addDays(date, 1), market)
);
