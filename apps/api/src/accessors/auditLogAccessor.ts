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

/** What LoggingUtility.recordAudit records (time is set by the database). */
export type NewAuditEntry = Omit<AuditEntry, 'id' | 'createdAt'>;

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
   * Appends an entry. Called only through LoggingUtility.recordAudit.
   *
   * @param entry - Actor, household, action, entity type and ID.
   * @returns The stored entry.
   */
  insert: async (entry: NewAuditEntry): Promise<AuditEntry> => {
    const [row] = await db.insert(auditLogEntries).values(entry).returning();
    return row!;
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
