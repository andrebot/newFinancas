import type { Account, DashboardReport, InvestmentHolding } from '@financas/api-types';
import type { Period } from '../../kit/periodBar/periodBar';
import type { DashboardRead } from './flows/dashboard/DashboardFlow';

// What the Review Insights Experience reads its queries into for the
// Dashboard (X8; OQ-242, OQ-243). Pure: the page hands these RTK Query's state
// and passes the results down as display state.

/** The part of an RTK Query hook's result a read is built from. */
export interface ReadState<Data> {
  readonly data?: Data | undefined;
  readonly isError: boolean;
}

/** The three reads the Dashboard waits for. */
export interface DashboardQueries {
  readonly report: ReadState<DashboardReport>;
  /** The household's Holdings, archived ones included: what names the report's ids. */
  readonly holdings: ReadState<readonly InvestmentHolding[]>;
  /** The accounts, for the balance cards. */
  readonly accounts: ReadState<readonly Account[]>;
}

/**
 * Reads the Dashboard as the Flow takes it: loaded once the report, the
 * Holdings and the accounts are all in; failed when any failed (OQ-242: one
 * banner in place of every panel).
 *
 * @param queries - The three reads.
 * @returns The Dashboard's read.
 */
export const dashboardReadOf = ({
  report, holdings, accounts,
}: DashboardQueries): DashboardRead => {
  if (report.data !== undefined && holdings.data !== undefined && accounts.data !== undefined) {
    return {
      status: 'loaded', report: report.data, holdings: holdings.data, accounts: accounts.data,
    };
  }
  return [report, holdings, accounts].some((query) => query.isError)
    ? { status: 'failed' }
    : { status: 'loading' };
};

/**
 * Reads the report's month — the server's, never the browser's (OQ-242).
 *
 * @param month - The report's `YYYY-MM`.
 * @returns The month as the period chip takes it.
 */
export const periodOfMonth = (month: string): Period => ({
  year: Number(month.slice(0, 4)),
  month: Number(month.slice(5, 7)),
});
