import type { CalendarMonth } from '../../utilities/calendarMonth';
import type { Goal } from '../../accessors/goalAccessor';
import auditLogCsv from './auditLogReport';
import { dashboard, type Dashboard } from './dashboard';
import { goalProgress, visibleAccountIdsOf, type GoalWithProgress } from './goalProgress';
import {
  investmentsOverview, payoutsReport, type InvestmentsDeps, type InvestmentsOverview,
  type PayoutSeries, type PayoutsQuery,
} from './investments';
import {
  monthOverview, type MonthOverview, type MonthOverviewDeps, type Viewer,
} from './monthOverview';

// ReportingEngine (E2, VBD §2.2): reshapes ledger, balance, Budget, Goal and
// Holding data into the read-side reports InsightsManager serves — the only
// Manager that calls it. Slice 3's part (OQ-206): the Month Overview and Goal
// progress (current and by month), plus the audit-log CSV (OQ-104); slice 4's
// (task 133, OQ-236): the investments overview and the payouts series; slice
// 5's (task 139, OQ-243): the Dashboard. It reads
// through the Accessors; the caller decides which Goals the viewer sees and
// which day "now" is.

export type { Contribution, Funding, GoalWithProgress } from './goalProgress';
export type { Dashboard } from './dashboard';
export type {
  BudgetStatus, CurrencySummary, MonthEndBalance, MonthOverview, StripMonth, Viewer,
} from './monthOverview';
export type {
  AllocationSlice, ComingDueEntry, InvestmentsOverview, MonthAmount, NetWorth, PayoutEntry,
  PayoutSeries, PayoutsQuery,
} from './investments';

/** What the Engine reads. */
export type ReportingEngineDeps = MonthOverviewDeps & InvestmentsDeps;

/**
 * Creates the reporting engine.
 *
 * @param deps - The Accessor reads.
 * @returns `monthOverview`, `goalProgress`, `investmentsOverview`, `payouts`,
 *   `dashboard` and `auditLogCsv`.
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

  /**
   * The Investments overview as a member sees it (FR-5.3, FR-5.9, OQ-233):
   * net worth per currency over the last months, this month's payouts, today's
   * allocation slices and the open fixed-term Holdings.
   *
   * @param viewer - The household and member.
   * @param today - `YYYY-MM-DD`.
   * @param months - How many months the net worth series covers at most.
   * @returns The overview.
   */
  investmentsOverview: (
    viewer: Viewer,
    today: string,
    months: number,
  ): Promise<InvestmentsOverview> => investmentsOverview(deps, viewer, { today, months }),

  /**
   * The chosen Holdings' monthly payouts (FR-5.9, OQ-233).
   *
   * @param viewer - The household and member.
   * @param query - The Holdings (every visible one when absent), the window and today.
   * @returns One series per Holding and currency paid within the window.
   */
  payouts: (viewer: Viewer, query: PayoutsQuery): Promise<PayoutSeries[]> => (
    payoutsReport(deps, viewer, query)
  ),

  /**
   * The v1 Dashboard's fixed panels as a member sees them, for today's month
   * (FR-6.0, OQ-242, OQ-243).
   *
   * @param viewer - The household and member.
   * @param today - `YYYY-MM-DD`.
   * @param netWorthMonths - How many months the net worth series covers at most.
   * @returns The panels.
   */
  dashboard: (viewer: Viewer, today: string, netWorthMonths: number): Promise<Dashboard> => (
    dashboard(deps, viewer, { today, netWorthMonths })
  ),

  auditLogCsv,
});

/** The ReportingEngine's operations. */
export type ReportingEngine = ReturnType<typeof createReportingEngine>;
