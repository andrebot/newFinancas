import { useState } from 'react';
import type { Period } from '../../kit/periodBar/periodBar';
import useToday from '../../utilities/useToday';
import { useGetMonthOverviewQuery } from './api';
import type { MonthOverviewFlowProps } from './flows/monthOverview/MonthOverviewFlow';
import { overviewReadOf, periodOf } from './manageFinances';

// The month the Manage Finances Experience holds for Month Overview (X6,
// OQ-221): today's month on arrival, its report the query's argument —
// refetched after every write through its tag — and read only from the
// query's `currentData`, so a month never shows another month's figures. The
// page mounts it only once the accounts are in, which the balances need.

/** What the page holds of the month, as Month Overview takes it. */
export type MonthSource = Pick<
  MonthOverviewFlowProps, 'period' | 'onPeriodChange' | 'overview' | 'onRetry'
>;

/**
 * Holds the month and its report for one household.
 *
 * @param householdId - The household.
 * @returns The month, its report and the Flow's handlers.
 */
export default function useMonthOverview(householdId: string): MonthSource {
  const today = useToday();
  const [period, setPeriod] = useState<Period>(() => periodOf(today));
  const query = useGetMonthOverviewQuery({ householdId, ...period });
  return {
    period,
    onPeriodChange: setPeriod,
    overview: overviewReadOf(query),
    onRetry: () => {
      query.refetch();
    },
  };
}
