import type { AuditEntry } from '../../accessors/auditLogAccessor';
import { toCsv, type CsvColumn } from './csv';

// ReportingEngine — the audit-log export (FR-7.2, OQ-104): receives the entries
// InsightsManager read through AuditLogAccessor and shapes them into a CSV report.

/** The report's columns: IDs only, as stored (FR-7.1 — no PII). */
export const AUDIT_LOG_COLUMNS: readonly CsvColumn<AuditEntry>[] = [
  { header: 'timestamp', value: (entry) => entry.createdAt.toISOString() },
  { header: 'actor_id', value: (entry) => entry.actorId ?? 'system' },
  { header: 'action', value: (entry) => entry.action },
  { header: 'entity_type', value: (entry) => entry.entityType },
  { header: 'entity_id', value: (entry) => entry.entityId },
];

/**
 * Shapes audit entries into the downloadable CSV report. Timestamps are ISO 8601
 * UTC; a system action (no actor) shows `system` (NFR-OBS-2's marker).
 *
 * @param entries - Entries in the order to export (oldest first).
 * @returns The CSV document.
 */
const auditLogCsv = (entries: readonly AuditEntry[]): string => toCsv(AUDIT_LOG_COLUMNS, entries);

export default auditLogCsv;
