import { monthsBetween, type CalendarMonth } from '../../accessors/calendarMonth';

// ReportingEngine — the calendar months its reports are keyed by: `YYYY-MM`
// strings in every report (OQ-201) and the month's last day for "as of the
// month's end" reads (FR-8.7). Pure helpers.

/**
 * Formats a month as reports key it.
 *
 * @param month - The month.
 * @returns `YYYY-MM`.
 */
export const monthKey = (month: CalendarMonth): string => (
  `${month.year}-${String(month.month).padStart(2, '0')}`
);

/**
 * The last day of a month.
 *
 * @param month - The month.
 * @returns `YYYY-MM-DD`.
 */
export const monthEnd = (month: CalendarMonth): string => {
  const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return `${monthKey(month)}-${String(lastDay).padStart(2, '0')}`;
};

/**
 * A calendar year's months, January to December (FR-6.11's strip).
 *
 * @param year - The year.
 * @returns Its twelve months, in order.
 */
export const yearMonths = (year: number): CalendarMonth[] => (
  monthsBetween({ year, month: 1 }, { year, month: 12 })
);
