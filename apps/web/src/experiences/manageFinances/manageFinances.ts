import type {
  GoalWithProgress, LedgerItem, MonthOverviewReport, TransactionPage,
} from '@financas/api-types';
import type { GroupedListStatus } from '../../kit/groupedList/GroupedList';
import { wholePercent } from '../../kit/progress/progress';
import type { Period } from '../../kit/periodBar/periodBar';
import { ownFundingOf } from '../goalFunding';
import type { MonthOverviewRead } from './flows/monthOverview/MonthOverviewFlow';
import type { SplitGoal } from './flows/recordTransaction/recordTransactionState';
import { isBuy } from './flows/recordTransaction/transactionForm';

// What the Manage Finances Experience reads its queries into for its Flows
// (X6; OQ-220, OQ-221, OQ-222). Pure: the page's hooks hand these RTK Query's
// state and pass the results down as display state.

/** What the ledger's infinite query holds, as far as the Flow's view needs. */
export interface LedgerQueryState {
  /** The pages for the current filters; undefined while they first load. */
  readonly pages: readonly TransactionPage[] | undefined;
  readonly isFetching: boolean;
  readonly isFetchingNextPage: boolean;
  readonly isError: boolean;
  readonly isFetchNextPageError: boolean;
}

/** What the month's report query holds, as far as the Flow needs. */
export interface ReportQueryState {
  /** The report for the month asked; undefined while the month changes. */
  readonly currentData?: MonthOverviewReport | undefined;
  readonly isError: boolean;
}

/**
 * Reads the month a date falls in.
 *
 * @param date - An ISO date, `YYYY-MM-DD`.
 * @returns Its year and month.
 */
export const periodOf = (date: string): Period => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
});

/**
 * Reads the ledger's status for the grouped list: an error once a page failed
 * (the next page's, or the first one's), loading while the first page or the
 * next is out, idle otherwise — a refetch after a write keeps the rows shown.
 *
 * @param query - The infinite query's state.
 * @returns The status.
 */
export const ledgerStatusOf = (query: LedgerQueryState): GroupedListStatus => {
  if (query.isFetchNextPageError || (query.isError && query.pages === undefined)) return 'error';
  if (query.isFetchingNextPage || (query.isFetching && query.pages === undefined)) return 'loading';
  return 'idle';
};

/**
 * Reads the month's report for Month Overview: only from the query's
 * `currentData`, never the previous month's report (OQ-221). The page reads
 * it only once the accounts are in, which name the balances.
 *
 * @param query - The report query's state.
 * @returns The Flow's read.
 */
export const overviewReadOf = (query: ReportQueryState): MonthOverviewRead => {
  if (query.currentData !== undefined) {
    return { status: 'loaded', report: query.currentData };
  }
  return query.isError ? { status: 'failed' } : { status: 'loading' };
};

/**
 * Reads the Goals as a trade's split names them: each with its progress in
 * its own currency — whole percent, rounded down — and whether it is
 * completed, the active ones first.
 *
 * @param active - The active Goals with their progress.
 * @param completed - The completed ones.
 * @returns The split's Goals.
 */
export const splitGoalsOf = (
  active: readonly GoalWithProgress[],
  completed: readonly GoalWithProgress[],
): readonly SplitGoal[] => [
  ...active.map((goal) => ({ goal, completed: false })),
  ...completed.map((goal) => ({ goal, completed: true })),
].map(({ goal, completed: done }) => ({
  id: goal.id,
  name: goal.name,
  progress: wholePercent(ownFundingOf(goal).funded, goal.targetAmount),
  completed: done,
}));

/**
 * Tells which Holding an edit must read before its drawer opens: a buy's, for
 * its terms (OQ-219). Other rows open straight away.
 *
 * @param item - The row to edit.
 * @returns The Holding's id, or nothing.
 */
export const holdingToReadFor = (item: LedgerItem): string | undefined => {
  if (item.ledger !== 'account' || !isBuy(item.kind ?? '')) return undefined;
  return item.holdingId ?? undefined;
};
