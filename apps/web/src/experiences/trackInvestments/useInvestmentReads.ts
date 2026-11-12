import { useListHouseholdHoldingsQuery } from '../../api/investmentsApi';
import { useListAccountsQuery } from '../../api/setupApi';
import { useGetInvestmentsOverviewQuery } from './api';
import type { OverviewRead } from './overviewRead';
import { overviewReadOf } from './trackInvestments';

// The read Track Investments' Flows share (X7; OQ-233, OQ-234): the
// overview with the household's Holdings — archived ones included — and its
// accounts, read once for Portfolio Overview and Holding Maintenance alike
// (RTK Query shares the cache between the tabs). The payout chart's question
// is shared with the Dashboard (`experiences/usePayoutChart.ts`, OQ-243).

/** The overview as the Flows take it, and the way to ask for it again. */
export interface OverviewState {
  readonly overview: OverviewRead;
  readonly onRetry: () => void;
}

/**
 * Reads the overview, the household's Holdings and its accounts.
 *
 * @param householdId - The household.
 * @returns The overview's read and its retry.
 */
export const useOverview = (householdId: string): OverviewState => {
  const report = useGetInvestmentsOverviewQuery(householdId);
  const holdings = useListHouseholdHoldingsQuery(householdId);
  const accounts = useListAccountsQuery(householdId);
  return {
    overview: overviewReadOf({ report, holdings, accounts }),
    onRetry: () => {
      [report, holdings, accounts].forEach((query) => {
        if (query.isError) query.refetch();
      });
    },
  };
};
