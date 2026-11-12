import type { Funding, GoalWithProgress, MonthOverview } from '../../engines/reporting';
import { createAuditExport, type AuditExport } from './auditExport';
import { createDashboard, type DashboardUseCases } from './dashboard';
import { createGoals, type Goals } from './goals';
import { createHoldings, type Holdings } from './holdings';
import { createInbox, type Inbox } from './inbox';
import { createReports, type Reports } from './reports';
import type { InsightsDeps } from './context';

// InsightsManager (M4, VBD §2.1): the user wants to see the state of things,
// aggregated or reshaped — slice 3's part (OQ-201): the Month Overview, Goal
// progress (current and by month) and the Holding reads with projections;
// slice 4's (task 133, OQ-236): the investments-overview and payouts reports
// and the household's Holdings; slice 5's (task 139, OQ-243): the Dashboard,
// the Notification Inbox and the audit-log export. It composes
// ReportingEngine for the reshaped reads and InvestmentProductEngine's
// `project` for a Holding's expected payout — the two Engines never call each
// other (VBD §2.2).

export type { InsightsDeps } from './context';
export type { ProjectedHolding } from './holdings';
export type {
  MonthAsked, ReportAsked, ReportType, TaggedReport,
} from './reports';
export type { AuditLogExport, ExportRange } from './auditExport';
export type {
  AuditExport, DashboardUseCases, Goals, Holdings, Inbox, Reports,
};
export type { Funding, GoalWithProgress, MonthOverview };

/**
 * Creates InsightsManager.
 *
 * @param deps - The Engines and Accessors it calls, and the clock.
 * @returns Every use case built so far.
 */
export const createInsightsManager = (deps: InsightsDeps) => ({
  ...createReports(deps),
  ...createGoals(deps),
  ...createHoldings(deps),
  ...createDashboard(deps),
  ...createInbox(deps),
  ...createAuditExport(deps),
});

export type InsightsManager = ReturnType<typeof createInsightsManager>;
