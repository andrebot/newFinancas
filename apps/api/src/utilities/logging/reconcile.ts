import path from 'node:path';
import type { NewAuditEntry } from '../../accessors/auditLogAccessor';
import { toAuditRecord, type AuditLogEvent } from './auditSink';

// Audit reconciliation (OQ-110): every audit event is in the daily JSON log
// files before it is stored, so entries the sink could not store are restored
// from there. Idempotent — entries already stored are skipped by ID.

/**
 * Extracts the audit records from one log file's text.
 *
 * @param text - JSON lines; other lines and malformed JSON are ignored.
 * @returns The audit records found.
 */
export const parseAuditRecords = (text: string): NewAuditEntry[] => text.split('\n')
  .flatMap((line) => {
    try {
      const record = toAuditRecord(JSON.parse(line) as AuditLogEvent);
      return record ? [record] : [];
    } catch {
      return [];
    }
  });

/** What reconciliation reads and writes. */
export interface ReconcileDeps {
  /** The daily log files, as paths. */
  readonly listLogFiles: () => Promise<string[]>;
  readonly readFile: (path: string) => Promise<string>;
  readonly insertMany: (records: readonly NewAuditEntry[]) => Promise<number>;
}

/**
 * Restores audit entries missing from the database, from the log files.
 *
 * @param deps - File access and the idempotent batch insert.
 * @returns How many entries were missing and are now stored.
 */
export const reconcileAudit = async (deps: ReconcileDeps): Promise<number> => {
  const files = await deps.listLogFiles();
  const records = (await Promise.all(files.map(deps.readFile))).flatMap(parseAuditRecords);
  return deps.insertMany(records);
};

/**
 * Picks a process's daily log files out of a directory listing.
 *
 * @param names - File names in the log directory.
 * @param prefix - The process's file prefix (`api`).
 * @returns The matching names, oldest first.
 */
export const logFilesFor = (names: readonly string[], prefix: string): string[] => names
  .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.log'))
  .sort();

/**
 * Builds `ReconcileDeps.listLogFiles` for a log directory.
 *
 * @param logDir - The log directory.
 * @param prefix - The process's file prefix (`api`).
 * @param readDir - Lists a directory (rejects when it doesn't exist).
 * @returns A function listing the process's daily files as paths, oldest first.
 */
export const logFileLister = (
  logDir: string,
  prefix: string,
  readDir: (dir: string) => Promise<string[]>,
) => async (): Promise<string[]> => logFilesFor(await readDir(logDir).catch(() => []), prefix)
  .map((name) => path.join(logDir, name));

/** The fields of a PostgreSQL error worth a log line. */
const DATABASE_FIELDS = ['code', 'detail', 'constraint'] as const;

/**
 * What a log line records about a failed reconciliation. Drizzle wraps the
 * database's refusal in an error whose message holds the whole batch insert —
 * every entry's values, megabytes for a day's log — so a wrapped failure is
 * logged by its cause alone: its text and PostgreSQL's code, detail and
 * constraint, when it has them.
 *
 * @param error - Anything `reconcileAudit` rejected with.
 * @returns The details to log.
 */
export const reconcileFailureDetails = (error: unknown): Record<string, unknown> => {
  const cause: unknown = error instanceof Error ? error.cause : undefined;
  if (cause === undefined) return { error: String(error) };
  const fields = typeof cause === 'object' && cause !== null
    ? DATABASE_FIELDS.flatMap((field) => {
      const value: unknown = (cause as Record<string, unknown>)[field];
      return value === undefined ? [] : [[field, value] as const];
    })
    : [];
  return { error: String(cause), ...Object.fromEntries(fields) };
};
