import { monthOf, type CalendarMonth } from './calendarMonth';

// Credit Card billing cycles (FR-2.8/FR-2.10). A cycle is named by the month it
// closes in (OQ-170). Pure helpers, no database.

const LAST_MONTH = 12;

/**
 * Counts the days of a month.
 *
 * @param month - The month.
 * @returns 28 to 31.
 */
const daysIn = (month: CalendarMonth): number => (
  new Date(Date.UTC(month.year, month.month, 0)).getUTCDate()
);

/**
 * Reads the month after a given one.
 *
 * @param month - The month.
 * @returns The next month.
 */
const nextMonth = (month: CalendarMonth): CalendarMonth => (
  month.month === LAST_MONTH
    ? { year: month.year + 1, month: 1 }
    : { year: month.year, month: month.month + 1 }
);

/**
 * Resolves the billing cycle a date falls in: a day up to the closing day is
 * in the cycle closing that month, a later one in the next month's. A closing
 * day past a short month's end closes on its last day.
 *
 * @param date - `YYYY-MM-DD`.
 * @param closingDay - The card's closing day, 1 to 31.
 * @returns The month the cycle closes in.
 */
const cycleOf = (date: string, closingDay: number): CalendarMonth => {
  const month = monthOf(date);
  const closesOn = Math.min(closingDay, daysIn(month));
  return Number(date.slice(8, 10)) <= closesOn ? month : nextMonth(month);
};

export default cycleOf;
