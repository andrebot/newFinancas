import { Writable } from 'node:stream';
import winston from 'winston';
import type { NewAuditEntry } from '../../accessors/auditLogAccessor';

// The audit sink (OQ-110): a Winston transport that takes only events marked
// `audit` and stores them in audit_log_entries through AuditLogAccessor — the
// locked FR-7.1 fields only, never details. Storing is retried in the background;
// what still fails is restored later from the log files (reconcile.ts).

/** An audit event as logged by `recordAudit` (and as it appears in the JSON file). */
export interface AuditLogEvent {
  readonly audit?: boolean | undefined;
  readonly auditId?: string | undefined;
  readonly auditAt?: string | undefined;
  readonly actorId?: string | null | undefined;
  readonly householdId?: string | null | undefined;
  readonly action?: string | undefined;
  readonly entityType?: string | undefined;
  readonly entityId?: string | undefined;
}

const REQUIRED_FIELDS = ['auditId', 'auditAt', 'action', 'entityType', 'entityId'] as const;

type CompleteAuditEvent = AuditLogEvent & Record<(typeof REQUIRED_FIELDS)[number], string>;

/**
 * Tells whether an event is an audit event with every required field.
 *
 * @param event - Any log event.
 * @returns `true` for a complete audit event.
 */
const isCompleteAuditEvent = (event: AuditLogEvent): event is CompleteAuditEvent => (
  event.audit === true && REQUIRED_FIELDS.every((field) => Boolean(event[field]))
);

/**
 * Maps a log event onto the audit record — the only place that decides what
 * reaches the audit table, so it can never receive details or other PII.
 *
 * @param event - Any log event.
 * @returns The audit record, or `undefined` for non-audit or malformed events.
 */
export const toAuditRecord = (event: AuditLogEvent): NewAuditEntry | undefined => {
  if (!isCompleteAuditEvent(event)) return undefined;
  return {
    id: event.auditId,
    createdAt: new Date(event.auditAt),
    actorId: event.actorId ?? null,
    householdId: event.householdId ?? null,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
  };
};

/** How the sink stores records and waits between attempts. */
export interface DeliveryDeps {
  readonly insert: (record: NewAuditEntry) => Promise<unknown>;
  readonly delaysMs: readonly number[];
  readonly sleep: (ms: number) => Promise<void>;
}

/**
 * Stores a record, retrying after each delay. A record already stored counts as
 * stored (the insert is idempotent).
 *
 * @param record - The audit record.
 * @param deps - Insert, retry schedule, sleep.
 * @param attempt - Which attempt this is (0-based).
 * @returns `true` once stored; `false` after the last attempt failed.
 */
export const deliverWithRetry = async (
  record: NewAuditEntry,
  deps: DeliveryDeps,
  attempt = 0,
): Promise<boolean> => {
  try {
    await deps.insert(record);
    return true;
  } catch {
    const delay = deps.delaysMs[attempt];
    if (delay === undefined) return false;
    await deps.sleep(delay);
    return deliverWithRetry(record, deps, attempt + 1);
  }
};

/**
 * Builds the audit transport. Logging never waits for the database: each record
 * is delivered in the background, and `onGiveUp` hears about the ones that
 * could not be stored (they remain in the log file for reconciliation).
 *
 * @param deps - Delivery dependencies plus the give-up callback.
 * @returns A Winston transport.
 */
export const createAuditSink = (
  deps: DeliveryDeps & { readonly onGiveUp: (record: NewAuditEntry) => void },
) => new winston.transports.Stream({
  // Its own level, so audit entries are stored whatever LOG_LEVEL the console uses.
  level: 'info',
  stream: new Writable({
    objectMode: true,
    write: (event: AuditLogEvent, _encoding, done) => {
      const record = toAuditRecord(event);
      if (record) {
        deliverWithRetry(record, deps).then((stored) => {
          if (!stored) deps.onGiveUp(record);
        });
      }
      done();
    },
  }),
});
