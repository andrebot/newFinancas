// Calendar months shared by the Accessors that keep one row per month
// (Budget Periods, Account and Credit Card month balances), and by the reads
// keyed by month — ReportingEngine's `YYYY-MM` keys and InsightsManager's
// "as of the month's end" day (FR-8.7). Pure helpers, no database.

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

/**
 * Formats a month as reports key it (OQ-201).
 *
 * @param month - The month.
 * @returns `YYYY-MM`.
 */
export const monthKey = (month: CalendarMonth): string => (
  `${month.year}-${String(month.month).padStart(2, '0')}`
);

/**
 * The last day of a month — "as of the month's end" reads take it (FR-8.7).
 *
 * @param month - The month.
 * @returns `YYYY-MM-DD`.
 */
export const monthEnd = (month: CalendarMonth): string => {
  const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return `${monthKey(month)}-${String(lastDay).padStart(2, '0')}`;
};
