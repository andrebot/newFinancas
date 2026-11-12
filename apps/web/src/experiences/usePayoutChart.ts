import { useMemo } from 'react';
import { useGetPayoutsQuery, useListHouseholdHoldingsQuery } from '../api/investmentsApi';
import { portfolio } from '../config/constants';
import { safeStorage } from '../utilities/safeStorage';
import { payoutsReadOf, type PayoutChartInput } from './payoutPanel';
import { chosenIdsOf, queryIdsOf } from './payoutSelection';
import usePayoutSelection from './usePayoutSelection';

// The payout chart's question, asked by the two Experiences that draw it —
// Track Investments' overview and Review Insights' Dashboard (FL18, FL21;
// OQ-233, OQ-243): the Holdings chosen, remembered per household, and the
// payouts report for them. The choice is the query's argument, so it lives
// with the query, in the Experience, never in a Flow.

/** Where the payout chart's $ / R$ pick is remembered, for every household (OQ-233). */
const PAYOUT_CURRENCY = safeStorage(() => window.localStorage, portfolio.payoutCurrencyStorageKey);

/**
 * Holds the payout chart's choice of Holdings — the payouts query's argument —
 * and reads the report for it (OQ-233). A list choice waits for the Holdings,
 * so a remembered Holding that is gone is never asked for; every Holding needs
 * none.
 *
 * @param householdId - The household.
 * @returns What the payout panel takes.
 */
const usePayoutChart = (householdId: string): PayoutChartInput => {
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

export default usePayoutChart;
