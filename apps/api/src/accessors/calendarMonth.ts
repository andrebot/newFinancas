// Calendar months shared by the Accessors that keep one row per month
// (Budget Periods, Account and Credit Card month balances). Pure helpers, no database.

/** A calendar month in the app's time zone — the Manager works it out (OQ-104). */
export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

/** The months a balance history covers; open ends reach the chain's ends. */
export interface MonthRange {
  readonly from?: CalendarMonth;
  readonly to?: CalendarMonth;
}

const MONTHS_PER_YEAR = 12;

/**
 * Reads the month of a calendar date.
 *
 * @param date - `YYYY-MM-DD`.
 * @returns Its year and month.
 */
export const monthOf = (date: string): CalendarMonth => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});

/**
 * Counts months from year 0, so months compare and subtract as numbers.
 *
 * @param month - The month.
 * @returns Its ordinal.
 */
export const monthOrdinal = (month: CalendarMonth): number => (
  month.year * MONTHS_PER_YEAR + month.month - 1
);

/**
 * Lists the months from one to another, both included, in order.
 *
 * @param from - The first month.
 * @param to - The last month.
 * @returns The months; empty when `to` is before `from`.
 */
export const monthsBetween = (from: CalendarMonth, to: CalendarMonth): CalendarMonth[] => {
  const first = monthOrdinal(from);
  const count = Math.max(monthOrdinal(to) - first + 1, 0);
  return Array.from({ length: count }, (_, offset) => ({
    year: Math.floor((first + offset) / MONTHS_PER_YEAR),
    month: ((first + offset) % MONTHS_PER_YEAR) + 1,
  }));
};
