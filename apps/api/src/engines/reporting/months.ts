import { monthsBetween, type CalendarMonth } from '../../accessors/calendarMonth';

// ReportingEngine — the calendar months its reports span. The `YYYY-MM` key and
// the month's last day are shared with InsightsManager, so they live with
// CalendarMonth (accessors/calendarMonth). Pure helpers.

/**
 * A calendar year's months, January to December (FR-6.11's strip).
 *
 * @param year - The year.
 * @returns Its twelve months, in order.
 */
const yearMonths = (year: number): CalendarMonth[] => (
  monthsBetween({ year, month: 1 }, { year, month: 12 })
);

export default yearMonths;
