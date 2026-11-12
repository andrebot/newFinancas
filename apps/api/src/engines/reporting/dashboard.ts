import { monthKey, monthOf } from '../../utilities/calendarMonth';
import {
  dashboardInvestments, type ComingDueEntry, type InvestmentsDeps, type NetWorth,
} from './investments';
import {
  monthOverview, type BudgetStatus, type MonthEndBalance, type MonthOverviewDeps, type Viewer,
} from './monthOverview';
import type { GoalWithProgress } from './goalProgress';

// ReportingEngine — the v1 Dashboard (FR-6.0, OQ-242, OQ-243): fixed panels for
// the current month. Net worth and Coming Due are the investments overview's,
// the balances, Budgets (over-budget first) and Goals the Month Overview's —
// the same shapes, so the app draws them with the same pieces. No payouts: the
// chart reads the payouts report with the user's own choice of Holdings.

/** What the Dashboard reads. */
export type DashboardDeps = MonthOverviewDeps & InvestmentsDeps;

/** The Dashboard's panels. */
export interface Dashboard {
  /** The month the panels are for, `YYYY-MM` — today's. */
  readonly month: string;
  readonly netWorth: readonly NetWorth[];
  readonly comingDue: readonly ComingDueEntry[];
  readonly balances: readonly MonthEndBalance[];
  readonly budgets: readonly BudgetStatus[];
  readonly goals: readonly GoalWithProgress[];
}

/**
 * Builds the Dashboard as a member sees it, for today's month.
 *
 * @param deps - The Accessor reads.
 * @param viewer - The household and member.
 * @param query - Today and how many months the net worth series covers.
 * @param query.today - `YYYY-MM-DD`.
 * @param query.netWorthMonths - The net worth series' length at most.
 * @returns The panels.
 */
export const dashboard = async (
  deps: DashboardDeps,
  viewer: Viewer,
  query: { readonly today: string; readonly netWorthMonths: number },
): Promise<Dashboard> => {
  const month = monthOf(query.today);
  const [overview, investments] = await Promise.all([
    monthOverview(deps, viewer, month),
    dashboardInvestments(deps, viewer, { today: query.today, months: query.netWorthMonths }),
  ]);
  return {
    month: monthKey(month),
    netWorth: investments.netWorth,
    comingDue: investments.comingDue,
    balances: overview.balances,
    budgets: overview.budgets,
    goals: overview.goals,
  };
};
