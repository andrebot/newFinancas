import type {
  GetReportResponse, HoldingAllocation, HoldingAllocations, IndexCode, IndexRateSeries,
  InvestmentHolding, InvestmentsOverviewReport, LedgerItem, ListHouseholdHoldingsResponse,
  ListIndexRatesResponse, ListValuationSnapshotsResponse, PayoutsReport, TransactionPage,
  ValuationSnapshot,
} from '@financas/api-types';
import backendApi, { changedTags } from '../../api/backendApi';
import send from '../../api/send';
import { holdingMaintenance } from '../../config/constants';

// The Track Investments Experience's own endpoints (X7; OQ-233..236): the
// Investments overview and the payouts reports, the household's Holdings,
// the index rates, an open Holding's split, value history and latest
// transactions, and the writes Holding and Rates Maintenance make. Every read
// built on the household's accounts or Goals also provides those shared tags,
// so a transaction recorded in Manage Finances refreshes the page (PR #145).
// A write that went through — or whose target is already gone — invalidates
// what it changed: a value the overview, the Goals' progress and the history;
// a split the Goals and the split; a rate the rates, the overview and the
// Holdings, whose expected payouts are projected from it (OQ-235).

/** What addresses a Holding inside its household. */
export interface HoldingTarget {
  readonly householdId: string;
  readonly holdingId: string;
}

/** The payouts report's question (OQ-233). */
export interface PayoutsInput {
  readonly householdId: string;
  /** The Holdings to sum; every visible one when absent. */
  readonly holdingIds: readonly string[] | undefined;
  /** How many months back, this one included. */
  readonly months: number;
}

/** A market value as the contract sends it, addressed to its Holding. */
export interface MarketValueInput extends HoldingTarget {
  /** Minor units. */
  readonly value: number;
  readonly asOf: string;
}

/** One of a Holding's manual snapshots. */
export interface SnapshotTarget extends HoldingTarget {
  readonly snapshotId: string;
}

/** A Holding's new split. */
export interface AllocationsInput extends HoldingTarget {
  readonly allocations: readonly HoldingAllocation[];
}

/** One index, inside its household. */
export interface IndexTarget {
  readonly householdId: string;
  readonly index: IndexCode;
}

/** A rate value as the contract sends it. */
export interface RateInput extends IndexTarget {
  /** Percent × 10,000 (OQ-86). */
  readonly value: number;
  readonly asOf: string;
}

/** One recorded value of an index. */
export interface RateValueTarget extends IndexTarget {
  readonly valueId: string;
}

/** The Experience's own caches. */
const OWN_TAGS = [
  'InvestmentsOverview', 'Payouts', 'Holdings', 'IndexRates', 'HoldingAllocations',
  'ValuationSnapshots', 'HoldingActivity',
] as const;

/** Builds a household's path. */
const householdPath = (householdId: string) => `/households/${encodeURIComponent(householdId)}`;

/** Builds one Holding's path inside its household. */
const holdingPath = ({ householdId, holdingId }: HoldingTarget) => (
  `${householdPath(householdId)}/holdings/${encodeURIComponent(holdingId)}`);

/** Builds one snapshot's path inside its Holding. */
const snapshotPath = ({ snapshotId, ...holding }: SnapshotTarget) => (
  `${holdingPath(holding)}/valuation-snapshots/${encodeURIComponent(snapshotId)}`);

/** Builds one index's values path inside its household. */
const indexValuesPath = ({ householdId, index }: IndexTarget) => (
  `${householdPath(householdId)}/index-rates/${encodeURIComponent(index)}/values`);

/** Builds one index value's path. */
const rateValuePath = ({ valueId, ...index }: RateValueTarget) => (
  `${indexValuesPath(index)}/${encodeURIComponent(valueId)}`);

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

/**
 * Builds the address of a Holding's latest transactions (OQ-234).
 *
 * @param target - The Holding.
 * @returns The ledger's path, filtered by the Holding and cut to the Activity card's count.
 */
export const activityPathOf = ({ householdId, holdingId }: HoldingTarget) => (
  `${householdPath(householdId)}/transactions?${new URLSearchParams({
    holdingId, limit: String(holdingMaintenance.activityCount),
  }).toString()}`);

/** What a market value write makes stale. */
const VALUE_TAGS = ['ValuationSnapshots', 'InvestmentsOverview', 'Goals'] as const;

/** What a split write makes stale. */
const SPLIT_TAGS = ['HoldingAllocations', 'Goals'] as const;

/** What a rate write makes stale (OQ-235). */
const RATE_TAGS = ['IndexRates', 'InvestmentsOverview', 'Holdings'] as const;

/** Track Investments' slice of the backend API. */
export const trackInvestmentsApi = backendApi.enhanceEndpoints({
  addTagTypes: [...OWN_TAGS],
}).injectEndpoints({
  endpoints: (build) => ({
    getInvestmentsOverview: build.query<InvestmentsOverviewReport, string>({
      query: (householdId) => `${householdPath(householdId)}/reports/investments-overview`,
      transformResponse: (response: GetReportResponse) => response as InvestmentsOverviewReport,
      providesTags: ['InvestmentsOverview', 'Accounts', 'Goals'],
    }),
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
    listIndexRates: build.query<readonly IndexRateSeries[], string>({
      query: (householdId) => `${householdPath(householdId)}/index-rates`,
      transformResponse: (response: ListIndexRatesResponse) => response.data,
      providesTags: ['IndexRates'],
    }),
    listHoldingSplit: build.query<readonly HoldingAllocation[], HoldingTarget>({
      query: (target) => `${holdingPath(target)}/allocations`,
      transformResponse: (response: HoldingAllocations) => response.data,
      providesTags: ['HoldingAllocations', 'Goals'],
    }),
    listValuationSnapshots: build.query<readonly ValuationSnapshot[], HoldingTarget>({
      query: (target) => `${holdingPath(target)}/valuation-snapshots`,
      transformResponse: (response: ListValuationSnapshotsResponse) => response.data ?? [],
      providesTags: ['ValuationSnapshots', 'Accounts'],
    }),
    listHoldingActivity: build.query<readonly LedgerItem[], HoldingTarget>({
      query: activityPathOf,
      transformResponse: (response: TransactionPage) => response.items ?? [],
      providesTags: ['HoldingActivity', 'Accounts'],
    }),
    saveHoldingAllocations: build.mutation<unknown, AllocationsInput>({
      query: ({ allocations, ...target }) => send('PATCH', holdingPath(target), { allocations }),
      invalidatesTags: (_result, error) => changedTags(SPLIT_TAGS, error, 'holding.not_found'),
    }),
    recordMarketValue: build.mutation<unknown, MarketValueInput>({
      query: ({ value, asOf, ...target }) => (
        send('POST', `${holdingPath(target)}/valuation-snapshots`, { value, asOf })
      ),
      invalidatesTags: (_result, error) => changedTags(VALUE_TAGS, error),
    }),
    editMarketValue: build.mutation<unknown, MarketValueInput & SnapshotTarget>({
      query: ({ value, asOf, ...target }) => send('PATCH', snapshotPath(target), { value, asOf }),
      invalidatesTags: (_result, error) => changedTags(VALUE_TAGS, error, 'snapshot.not_found'),
    }),
    deleteMarketValue: build.mutation<void, SnapshotTarget>({
      query: (target) => send('DELETE', snapshotPath(target)),
      invalidatesTags: (_result, error) => changedTags(VALUE_TAGS, error, 'snapshot.not_found'),
    }),
    recordIndexRate: build.mutation<unknown, RateInput>({
      query: ({ value, asOf, ...index }) => send('POST', indexValuesPath(index), { value, asOf }),
      invalidatesTags: (_result, error) => changedTags(RATE_TAGS, error),
    }),
    editIndexRate: build.mutation<unknown, RateInput & RateValueTarget>({
      query: ({ value, asOf, ...target }) => send('PATCH', rateValuePath(target), { value, asOf }),
      invalidatesTags: (_result, error) => changedTags(RATE_TAGS, error, 'index_rate.not_found'),
    }),
    deleteIndexRate: build.mutation<void, RateValueTarget>({
      query: (target) => send('DELETE', rateValuePath(target)),
      invalidatesTags: (_result, error) => changedTags(RATE_TAGS, error, 'index_rate.not_found'),
    }),
  }),
});

export const {
  useGetInvestmentsOverviewQuery,
  useGetPayoutsQuery,
  useListHouseholdHoldingsQuery,
  useListIndexRatesQuery,
  useListHoldingSplitQuery,
  useListValuationSnapshotsQuery,
  useListHoldingActivityQuery,
  useSaveHoldingAllocationsMutation,
  useRecordMarketValueMutation,
  useEditMarketValueMutation,
  useDeleteMarketValueMutation,
  useRecordIndexRateMutation,
  useEditIndexRateMutation,
  useDeleteIndexRateMutation,
} = trackInvestmentsApi;
