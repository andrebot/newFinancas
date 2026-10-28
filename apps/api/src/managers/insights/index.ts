import type { GoalWithProgress, MonthOverview } from '../../engines/reporting';
import { createGoals, type Goals } from './goals';
import { createHoldings, type Holdings } from './holdings';
import { createReports, type Reports } from './reports';
import type { InsightsDeps } from './context';

// InsightsManager (M4, VBD §2.1): the user wants to see the state of things,
// aggregated or reshaped — slice 3's part (OQ-201): the Month Overview, Goal
// progress (current and by month) and the Holding reads with projections. The
// investments-overview / payouts reports land beside their first caller
// (task 133); the Dashboard, inbox and audit export in slice 5. It composes
// ReportingEngine for the reshaped reads and InvestmentProductEngine's
// `project` for a Holding's expected payout — the two Engines never call each
// other (VBD §2.2).

export type { InsightsDeps } from './context';
export type { ProjectedHolding } from './holdings';
export type { MonthAsked } from './reports';
export type { Goals, Holdings, Reports };
export type { GoalWithProgress, MonthOverview };

/**
 * Creates InsightsManager.
 *
 * @param deps - The Engines and Accessors it calls, and the clock.
 * @returns Every slice-3 use case.
 */
export const createInsightsManager = (deps: InsightsDeps) => ({
  ...createReports(deps),
  ...createGoals(deps),
  ...createHoldings(deps),
});

export type InsightsManager = ReturnType<typeof createInsightsManager>;
