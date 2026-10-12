import { redact } from './redact';

// What the logger adds to every event before any transport sees it (OQ-110).

/** Fields the logger and its callers set; never redacted, never shown as details. */
export const RESERVED_FIELDS = new Set([
  'level', 'message', 'timestamp', 'label', 'correlationId', 'actor', 'stack',
  'auditId', 'auditAt', 'householdId', 'entityType', 'entityId', 'consoleOnly',
]);

/** A Winston info object, as far as these formats are concerned. */
export type LogEvent = Record<string, unknown> & { level: string; message: unknown };

/**
 * Gives an audit event its own ID and the time of the action, so storing it,
 * retrying and reconciling all refer to the same entry. Other events pass through.
 *
 * @param event - The event (already timestamped).
 * @param newId - ID source.
 * @returns The event, stamped when it is an audit event without an ID.
 */
export const stampAudit = (event: LogEvent, newId: () => string): LogEvent => (
  event.level === 'audit' && event.auditId === undefined
    ? { ...event, auditId: newId(), auditAt: event.timestamp }
    : event
);

/**
 * Tells whether an event must stay out of the log files: it carries a live
 * secret the developer needs to see once, e.g. the console email provider's
 * password-reset link (OQ-112). Set `consoleOnly: true` on the event.
 *
 * @param event - The event.
 * @returns Whether only the console may show it.
 */
export const isConsoleOnly = (event: LogEvent): boolean => event.consoleOnly === true;

/**
 * Redacts credential-like values anywhere in the event (no reserved field name
 * looks like a secret, so they pass through unchanged). The logger merges the
 * result back, keeping Winston's own symbol keys.
 *
 * @param event - The event.
 * @returns The event with sensitive values replaced.
 */
export const redactEvent = (event: LogEvent): LogEvent => redact(event) as LogEvent;
