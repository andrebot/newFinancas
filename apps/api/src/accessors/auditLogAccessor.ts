import {
  and, asc, eq, gte, lt, sql,
} from 'drizzle-orm';
import { calendar } from '../config/constants';
import type { Database } from '../db/database';
import { auditLogEntries } from '../db/schema';

// AuditLogAccessor (A15, VBD): the append-only audit log (FR-7.1, NFR-AUD-1).
// It offers no update or delete — and the application role has no privilege
// for them either (N5). Entries hold IDs only, no before/after values or PII.

/** One audit entry. `actorId` is null for system actions (e.g. the daily job). */
export interface AuditEntry {
  readonly id: string;
  readonly actorId: string | null;
  readonly householdId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly createdAt: Date;
}

/**
 * What LoggingUtility's audit sink records. It supplies the ID and the time of
 * the action itself, so a retried or reconciled entry is the same entry (OQ-110).
 */
export type NewAuditEntry = AuditEntry;

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

/**
 * The instant a calendar date starts in the app timezone (OQ-104), computed by
 * Postgres so daylight-saving rules are applied correctly.
 *
 * @param date - `YYYY-MM-DD`.
 * @param plusDays - Days to add first (1 gives the end of an inclusive range).
 * @returns SQL for a `timestamptz`.
 */
const startOfDay = (date: IsoDate, plusDays = 0) => (
  sql`((${date}::date + ${plusDays}::int)::timestamp AT TIME ZONE ${calendar.timeZone})`
);

/**
 * Builds the AuditLogAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createAuditLogAccessor = (db: Database) => ({
  /**
   * Appends an entry — called only by LoggingUtility's audit sink. Idempotent: an
   * entry whose ID is already stored is skipped, so retries and reconciliation
   * never duplicate (OQ-110).
   *
   * @param entry - ID, time, actor, household, action, entity type and ID.
   * @returns `true` when stored now; `false` when it was already there.
   */
  insert: async (entry: NewAuditEntry): Promise<boolean> => (
    await db.insert(auditLogEntries).values(entry).onConflictDoNothing()
      .returning({ id: auditLogEntries.id })
  ).length > 0,

  /**
   * Appends many entries at once, skipping IDs already stored (reconciliation).
   *
   * @param entries - Entries recovered from the log files.
   * @returns How many were missing and are now stored.
   */
  insertMany: async (entries: readonly NewAuditEntry[]): Promise<number> => {
    if (entries.length === 0) return 0;
    return (
      await db.insert(auditLogEntries).values([...entries]).onConflictDoNothing()
        .returning({ id: auditLogEntries.id })
    ).length;
  },

  /**
   * Lists a household's entries over an inclusive date range, oldest first —
   * the audit log's only way out (FR-7.2, OQ-46). Days are app-timezone days.
   *
   * @param householdId - The household.
   * @param startDate - First day included.
   * @param endDate - Last day included.
   * @returns The entries, ordered by time then id.
   */
  listForExport: async (
    householdId: string,
    startDate: IsoDate,
    endDate: IsoDate,
  ): Promise<AuditEntry[]> => db.select().from(auditLogEntries)
    .where(and(
      eq(auditLogEntries.householdId, householdId),
      gte(auditLogEntries.createdAt, startOfDay(startDate)),
      lt(auditLogEntries.createdAt, startOfDay(endDate, 1)),
    ))
    .orderBy(asc(auditLogEntries.createdAt), asc(auditLogEntries.id)),
});

/** The AuditLogAccessor's operations. */
export type AuditLogAccessor = ReturnType<typeof createAuditLogAccessor>;

export default createAuditLogAccessor;
