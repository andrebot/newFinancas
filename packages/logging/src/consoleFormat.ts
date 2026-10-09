// The human-readable console line (OQ-110). The file keeps the full JSON event;
// the console shows one scannable line per event:
//   14:03:12 AUDIT [7f3a9c21] user:0199c5a0… CreateBudget  Budget 0199c5f1… (household …)

/** The fields of a Winston info object the console line uses. */
export interface ConsoleEvent {
  readonly level: string;
  readonly message: unknown;
  readonly timestamp?: string;
  readonly correlationId?: string;
  readonly actor?: string;
  readonly audit?: boolean;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly householdId?: string | null;
  readonly details?: unknown;
  readonly stack?: string;
}

/**
 * Renders the event's extra information: an audit target, or the details.
 *
 * @param event - The event.
 * @returns The trailing text, possibly empty.
 */
const suffix = (event: ConsoleEvent): string => {
  if (event.audit) {
    const household = event.householdId ? ` (household ${event.householdId})` : '';
    return `${event.entityType} ${event.entityId}${household}`;
  }
  if (event.details === undefined) return '';
  return Object.entries(event.details as Record<string, unknown>)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');
};

/**
 * Renders an event's time as local wall-clock time (the file keeps UTC).
 *
 * @param timestamp - ISO timestamp, if any.
 * @param timeZone - IANA zone; the machine's own when omitted.
 * @returns `HH:mm:ss`, or an empty string.
 */
const clockTime = (timestamp: string | undefined, timeZone: string | undefined): string => (
  timestamp
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
  const time = clockTime(event.timestamp, timeZone);
  const level = (event.audit ? 'audit' : event.level).toUpperCase().padEnd(5);
  const correlation = event.correlationId ? `[${event.correlationId.slice(0, 8)}]` : '[--------]';
  const head = [time, level, correlation, event.actor ?? '-', String(event.message)].join(' ');
  const tail = suffix(event);
  const line = tail ? `${head}  ${tail}` : head;
  return event.stack ? `${line}\n${event.stack}` : line;
};
