import { validationFailed } from '../../utilities/domainError';
import { requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import type { InsightsDeps } from './context';

// The audit-log export (FR-7.2, OQ-46, OQ-104) on
// `GET /households/:householdId/audit-log/export`: an Owner or Admin downloads
// the household's entries over a date range as CSV. The Manager checks the role
// and the range, AuditLogAccessor reads the entries (inclusive app-timezone
// days, oldest first) and ReportingEngine writes the CSV. A read: nothing is
// audited (VBD §3.0).

/** The days an export covers, both included (`YYYY-MM-DD`). */
export interface ExportRange {
  readonly startDate: string;
  readonly endDate: string;
}

/** The export: the CSV and the name it downloads as. */
export interface AuditLogExport {
  readonly csv: string;
  readonly filename: string;
}

/**
 * Builds the audit-log export use case.
 *
 * @param deps - The tier below.
 * @returns `exportAuditLog`.
 */
export const createAuditExport = (deps: InsightsDeps) => ({
  /**
   * The household's audit log over a range, as CSV (OQ-243: both days
   * required, the end not before the start).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param range - The first and last day included.
   * @returns The CSV and its file name.
   * @throws {DomainError} `household.not_found`; `auth.forbidden` below Admin;
   *   `validation.failed` (`endDate`, `date.before_start`).
   */
  exportAuditLog: async (
    context: SignedInContext,
    householdId: string,
    range: ExportRange,
  ): Promise<AuditLogExport> => {
    await requireAccess(deps.authorization, context.actor.userId, householdId, {
      action: 'audit.export',
    });
    if (range.endDate < range.startDate) {
      throw validationFailed([{ field: 'endDate', code: 'date.before_start' }]);
    }
    const entries = await deps.auditLog.listForExport(householdId, range.startDate, range.endDate);
    return {
      csv: deps.reporting.auditLogCsv(entries),
      filename: `audit-log-${range.startDate}-${range.endDate}.csv`,
    };
  },
});

export type AuditExport = ReturnType<typeof createAuditExport>;
