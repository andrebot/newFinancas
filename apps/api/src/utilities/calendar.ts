// Calendar dates in the app's time zone (OQ-104). A Manager works out "today"
// with this before it hands a date to an Accessor; stored instants stay UTC.

/**
 * The calendar date an instant falls on in a time zone.
 *
 * @param instant - The moment.
 * @param timeZone - An IANA time zone, e.g. `America/Sao_Paulo`.
 * @returns `YYYY-MM-DD`.
 */
const calendarDate = (instant: Date, timeZone: string): string => (
  // en-CA formats a date as YYYY-MM-DD.
  new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant)
);

export default calendarDate;
