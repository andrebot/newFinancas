// What the period bar (K40, OQ-216) reads from its year and today: how tall
// each month's in / out bars stand, which months lie ahead, and where the
// year and month arrows lead. Pure, so it tests without React. Months count
// 1–12; today is the local `YYYY-MM-DD` of `useToday`.

/** A month as the bar names it: its year and its number, 1–12. */
export interface Period {
  readonly year: number;
  readonly month: number;
}

/** One month's money in and out, in one currency's minor units (FR-6.11). */
export interface PeriodMonth {
  /** 1–12. */
  readonly month: number;
  readonly in: number;
  readonly out: number;
}

/** A month's two bars, as percents of the strip's height. */
export interface BarHeights {
  readonly in: number;
  readonly out: number;
}

/**
 * Reads the month today falls in.
 *
 * @param today - Today, `YYYY-MM-DD`.
 * @returns Its year and month.
 */
export const periodOf = (today: string): Period => ({
  year: Number(today.slice(0, 4)),
  month: Number(today.slice(5, 7)),
});

/**
 * Orders a month on one line, so months compare as numbers.
 *
 * @param period - The month.
 * @returns How many months it lies from year 0.
 */
const monthIndex = (period: Period): number => period.year * 12 + period.month - 1;

/**
 * Tells whether a month starts after today's: nothing has happened in it yet,
 * so it can't be picked (OQ-216).
 *
 * @param period - The month.
 * @param today - Today, `YYYY-MM-DD`.
 * @returns Whether the month lies ahead.
 */
export const isFuture = (period: Period, today: string): boolean => (
  monthIndex(period) > monthIndex(periodOf(today))
);

/**
 * Moves a month forward or back, across a year's end.
 *
 * @param period - The month.
 * @param delta - How many months to move; negative goes back.
 * @returns The month reached.
 */
export const stepMonth = (period: Period, delta: number): Period => {
  const index = monthIndex(period) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

/**
 * Moves to another year keeping the month, held back to today's month when it
 * would lie ahead (OQ-216).
 *
 * @param period - The month.
 * @param year - The year to show.
 * @param today - Today, `YYYY-MM-DD`.
 * @returns The month to select in that year.
 */
export const switchYear = (period: Period, year: number, today: string): Period => {
  const moved = { year, month: period.month };
  return isFuture(moved, today) ? periodOf(today) : moved;
};

/**
 * Scales each month's bars against the year's largest figure, in or out, so
 * the strip shows how the months compare. Figures below zero (refunds that
 * outweigh spend) stand as empty bars.
 *
 * @param months - The year's months in one currency.
 * @returns Each month's bars by month number, as percents of the strip's height.
 */
export const barHeights = (months: readonly PeriodMonth[]): ReadonlyMap<number, BarHeights> => {
  const largest = Math.max(0, ...months.flatMap((entry) => [entry.in, entry.out]));
  const share = (amount: number) => (largest > 0 ? (Math.max(0, amount) / largest) * 100 : 0);
  return new Map(months.map((entry) => [
    entry.month,
    { in: share(entry.in), out: share(entry.out) },
  ]));
};
