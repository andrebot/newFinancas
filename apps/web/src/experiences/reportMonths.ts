// The calendar months the investments reports speak in (FL18, FL21; OQ-233):
// `YYYY-MM`, as the payouts and net worth series send them. Pure, with no
// time zone involved — a month is only its year and number.

/**
 * Splits a month into its year and number.
 *
 * @param month - `YYYY-MM`.
 * @returns The year and the month, 1–12.
 */
const partsOf = (month: string) => ({
  year: Number(month.slice(0, 4)),
  number: Number(month.slice(5, 7)),
});

/**
 * Writes a year and month number as `YYYY-MM`, carrying over a number outside 1–12.
 *
 * @param year - The year.
 * @param number - The month's number; 0 is the previous December, 13 the next January.
 * @returns The month.
 */
const monthOf = (year: number, number: number) => {
  const index = year * 12 + number - 1;
  const yearText = String(Math.floor(index / 12)).padStart(4, '0');
  return `${yearText}-${String((index % 12) + 1).padStart(2, '0')}`;
};

/**
 * Tells the month of a day.
 *
 * @param isoDate - `YYYY-MM-DD`.
 * @returns Its month, `YYYY-MM`.
 */
export const monthOfDate = (isoDate: string) => isoDate.slice(0, 7);

/**
 * Moves a month back or forward.
 *
 * @param month - `YYYY-MM`.
 * @param delta - How many months; negative goes back.
 * @returns The month reached.
 */
export const shiftMonth = (month: string, delta: number) => {
  const { year, number } = partsOf(month);
  return monthOf(year, number + delta);
};

/**
 * Tells a month's last day, where a month's figure sits on a line chart (K38).
 *
 * @param month - `YYYY-MM`.
 * @returns `YYYY-MM-DD`.
 */
export const monthEnd = (month: string) => {
  const { year, number } = partsOf(month);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
};

/**
 * Lists the months of a window that ends at a month.
 *
 * @param last - The newest month, `YYYY-MM`.
 * @param count - How many months.
 * @returns The months, oldest first.
 */
export const monthsEndingAt = (last: string, count: number) => (
  Array.from({ length: count }, (_, index) => shiftMonth(last, index - count + 1))
);
