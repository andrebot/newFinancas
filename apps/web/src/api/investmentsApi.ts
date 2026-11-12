import type {
  GetReportResponse, InvestmentHolding, ListHouseholdHoldingsResponse, PayoutsReport,
} from '@financas/api-types';
import backendApi from './backendApi';

// The investment reads two Experiences share (task 139, OQ-243): the
// household's Holdings, archived ones included (OQ-233), and the payouts
// report the payout chart reads with the user's choice of Holdings. Track
// Investments' overview and Review Insights' Dashboard both draw the chart and
// name a report's ids from the Holdings, so the reads belong to neither
// Experience's slice (the slice 4 review's A1 rule). Both are built on the
// household's accounts, so a transaction recorded in Manage Finances refreshes
// them (PR #145); a rate write refreshes the Holdings, whose expected payouts
// are projected from it (OQ-235).

/** The payouts report's question (OQ-233). */
export interface PayoutsInput {
  readonly householdId: string;
  /** The Holdings to sum; every visible one when absent. */
  readonly holdingIds: readonly string[] | undefined;
  /** How many months back, this one included. */
  readonly months: number;
}

/** Builds a household's path. */
const householdPath = (householdId: string) => `/households/${encodeURIComponent(householdId)}`;

/**
 * Builds the payouts report's address: the Holdings comma-joined, as the
 * contract's `explode: false` asks, and left out for every Holding.
 *
 * @param input - The household, the Holdings and the window.
 * @returns The report's path and search.
 */
export const payoutsPathOf = ({ householdId, holdingIds, months }: PayoutsInput) => {
  const params = new URLSearchParams({ months: String(months) });
  if (holdingIds !== undefined) params.set('holdingIds', holdingIds.join(','));
  return `${householdPath(householdId)}/reports/payouts?${params.toString()}`;
};

/** The shared investment reads. */
export const investmentsApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Payouts', 'Holdings'],
}).injectEndpoints({
  endpoints: (build) => ({
    getPayouts: build.query<PayoutsReport, PayoutsInput>({
      query: payoutsPathOf,
      transformResponse: (response: GetReportResponse) => response as PayoutsReport,
      providesTags: ['Payouts', 'Accounts'],
    }),
    listHouseholdHoldings: build.query<readonly InvestmentHolding[], string>({
      query: (householdId) => `${householdPath(householdId)}/holdings?includeArchived=true`,
      transformResponse: (response: ListHouseholdHoldingsResponse) => response.data ?? [],
      providesTags: ['Holdings', 'Accounts'],
    }),
  }),
});

export const { useGetPayoutsQuery, useListHouseholdHoldingsQuery } = investmentsApi;
