import { RESERVED_FIELDS } from './formats';

// The human-readable console line (OQ-110). The file keeps the full JSON event;
// the console shows one scannable line per event, in local wall-clock time:
//   14:03:12 AUDIT [7f3a9c21] user:0199c5a0 IdentityManager: Login  Session s1
//   14:03:12 INFO  [7f3a9c21] user:0199c5a0 http: GET /health  status=200 durationMs=1

/** A Winston info object, as the console line reads it. */
export type ConsoleEvent = Record<string, unknown> & { level: string; message: unknown };

/**
 * Renders the event's extra information: an audit target, or the other fields.
 *
 * @param event - The event.
 * @returns The trailing text, possibly empty.
 */
const suffix = (event: ConsoleEvent): string => {
  if (event.level === 'audit') {
    const household = event.householdId ? ` (household ${String(event.householdId)})` : '';
    return `${String(event.entityType)} ${String(event.entityId)}${household}`;
  }
  return Object.entries(event)
    .filter(([key]) => !RESERVED_FIELDS.has(key))
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
};

/**
 * Renders an event's time as local wall-clock time.
 *
 * @param timestamp - ISO timestamp, if any.
 * @param timeZone - IANA zone; the machine's own when omitted.
 * @returns `HH:mm:ss`, or an empty string.
 */
const clockTime = (timestamp: unknown, timeZone: string | undefined): string => (
  typeof timestamp === 'string'
    ? new Date(timestamp).toLocaleTimeString('en-GB', {
      hour12: false, ...(timeZone ? { timeZone } : {}),
    })
    : ''
);

/**
 * Formats one event as a console line (plus the stack trace on the next lines).
 *
 * @param event - The Winston info object.
 * @param timeZone - IANA zone for the time; the machine's own by default.
 * @returns The line.
 */
export const formatConsoleLine = (event: ConsoleEvent, timeZone?: string): string => {
  const correlation = typeof event.correlationId === 'string'
    ? `[${event.correlationId.slice(0, 8)}]`
    : '[--------]';
  const label = typeof event.label === 'string' ? `${event.label}: ` : '';
  const head = [
    clockTime(event.timestamp, timeZone), event.level.toUpperCase().padEnd(5), correlation,
    typeof event.actor === 'string' ? event.actor : '-', `${label}${String(event.message)}`,
  ].join(' ');
  const tail = suffix(event);
  const line = tail ? `${head}  ${tail}` : head;
  return typeof event.stack === 'string' ? `${line}\n${event.stack}` : line;
};
