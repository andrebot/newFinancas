import { investmentsReports } from '../../config/constants';
import type { Dashboard } from '../../engines/reporting';
import { memberOnly, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import { todayOf, type InsightsDeps } from './context';

// The v1 Dashboard (FR-6.0, OQ-67) on `GET /households/:householdId/dashboard`:
// fixed panels for today's month — no stored layout, widgets are v3. Every
// member may read it; what each sees is ReportingEngine's to narrow. The
// Manager only decides the day (OQ-242: the server's month, never the
// browser's) — and sends no payouts, which the chart reads with the user's own
// choice of Holdings (OQ-243).

/**
 * Builds the Dashboard use case.
 *
 * @param deps - The tier below.
 * @returns `getDashboard`.
 */
export const createDashboard = (deps: InsightsDeps) => ({
  /**
   * The Dashboard's panels as the member sees them, for today's month.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @returns The panels, with the month they are for.
   * @throws {DomainError} `household.not_found`.
   */
  getDashboard: async (context: SignedInContext, householdId: string): Promise<Dashboard> => {
    const viewerUserId = context.actor.userId;
    await requireAccess(deps.authorization, viewerUserId, householdId, memberOnly);
    return deps.reporting.dashboard(
      { householdId, viewerUserId },
      todayOf(deps),
      investmentsReports.netWorthMonths,
    );
  },
});

export type DashboardUseCases = ReturnType<typeof createDashboard>;
