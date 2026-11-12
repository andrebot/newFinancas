import { useMemo } from 'react';
import { useListAccountsQuery } from '../../api/setupApi';
import { portfolio } from '../../config/constants';
import { safeStorage } from '../../utilities/safeStorage';
import { chosenIdsOf, queryIdsOf } from '../payoutSelection';
import usePayoutSelection from '../usePayoutSelection';
import {
  useGetInvestmentsOverviewQuery, useGetPayoutsQuery, useListHouseholdHoldingsQuery,
} from './api';
import type { PayoutChartInput } from '../payoutPanel';
import type { OverviewRead } from './overviewRead';
import { overviewReadOf, payoutsReadOf } from './trackInvestments';

// The reads Track Investments' Flows share (X7; OQ-233, OQ-234): the
// overview with the household's Holdings — archived ones included — and its
// accounts, read once for Portfolio Overview and Holding Maintenance alike
// (RTK Query shares the cache between the tabs), and the payout chart's
// question: the Holdings chosen, remembered per household, and its report.

/** Where the payout chart's $ / R$ pick is remembered, for every household (OQ-233). */
const PAYOUT_CURRENCY = safeStorage(() => window.localStorage, portfolio.payoutCurrencyStorageKey);

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

/**
 * Holds the payout chart's choice of Holdings — the payouts query's argument —
 * and reads the report for it (OQ-233). A list choice waits for the Holdings,
 * so a remembered Holding that is gone is never asked for; every Holding needs
 * none.
 *
 * @param householdId - The household.
 * @returns What the payout panel takes.
 */
export const usePayouts = (householdId: string): PayoutChartInput => {
  const memory = useMemo(() => safeStorage(
    () => window.localStorage,
    `${portfolio.payoutSelectionStorageKey}.${householdId}`,
  ), [householdId]);
  const { selection, choose } = usePayoutSelection(memory);
  const holdings = useListHouseholdHoldingsQuery(householdId).data;
  const waiting = selection !== 'all' && holdings === undefined;
  const query = useGetPayoutsQuery({
    householdId,
    holdingIds: queryIdsOf(selection, holdings ?? []),
    months: portfolio.payoutMonths,
  }, { skip: waiting });
  return {
    read: payoutsReadOf(query),
    chosen: chosenIdsOf(selection, holdings ?? []),
    onChosenChange: (ids) => choose(ids, holdings ?? []),
    onRetry: () => {
      query.refetch();
    },
    currencyMemory: PAYOUT_CURRENCY,
  };
};
