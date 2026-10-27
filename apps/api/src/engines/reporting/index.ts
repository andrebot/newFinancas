import type { CalendarMonth } from '../../accessors/calendarMonth';
import type { Goal } from '../../accessors/goalAccessor';
import auditLogCsv from './auditLogReport';
import { goalProgress, visibleAccountIdsOf, type GoalWithProgress } from './goalProgress';
import {
  monthOverview, type MonthOverview, type MonthOverviewDeps, type Viewer,
} from './monthOverview';

// ReportingEngine (E2, VBD §2.2): reshapes ledger, balance, Budget, Goal and
// Holding data into the read-side reports InsightsManager serves — the only
// Manager that calls it. Slice 3's part (OQ-206): the Month Overview and Goal
// progress (current and by month), plus the audit-log CSV (OQ-104). It reads
// through the Accessors; the caller decides which Goals the viewer sees and
// which day "now" is.

export type { Contribution, Funding, GoalWithProgress } from './goalProgress';
export type {
  BudgetStatus, CurrencySummary, MonthEndBalance, MonthOverview, StripMonth, Viewer,
} from './monthOverview';

/** What the Engine reads. */
export type ReportingEngineDeps = MonthOverviewDeps;

/**
 * Creates the reporting engine.
 *
 * @param deps - The Accessor reads.
 * @returns `monthOverview`, `goalProgress` and `auditLogCsv`.
 */
export const createReportingEngine = (deps: ReportingEngineDeps) => ({
  /**
   * A month's overview as a member sees it (FR-6.11).
   *
   * @param viewer - The household and member.
   * @param month - The month.
   * @returns The overview.
   */
  monthOverview: (viewer: Viewer, month: CalendarMonth): Promise<MonthOverview> => (
    monthOverview(deps, viewer, month)
  ),

  /**
   * Some Goals' progress on a day (FR-8.5, FR-8.7): today for the current
   * view, a month's end by month. Funding in an Account the member can't see
   * counts, unnamed (OQ-206).
   *
   * @param viewer - The household and member.
   * @param goals - The Goals, already narrowed to what the member sees.
   * @param date - The day, `YYYY-MM-DD`.
   * @returns Each Goal with its progress, in the order given.
   */
  goalProgress: async (
    viewer: Viewer,
    goals: readonly Goal[],
    date: string,
  ): Promise<GoalWithProgress[]> => {
    const accounts = await deps.listAccounts(viewer.householdId, viewer.viewerUserId);
    return goalProgress(deps, goals, {
      householdId: viewer.householdId, visibleAccountIds: visibleAccountIdsOf(accounts), date,
    });
  },

  auditLogCsv,
});

/** The ReportingEngine's operations. */
export type ReportingEngine = ReturnType<typeof createReportingEngine>;
