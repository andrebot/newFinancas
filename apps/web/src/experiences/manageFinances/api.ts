import type {
  GetReportResponse, HoldingAllocation, HoldingAllocations, InvestmentHolding,
  InvestmentScheduleEntry, ListHoldingsResponse,
  ListScheduleEntriesResponse, MonthOverviewReport, TransactionCreateRequest, TransactionPage,
  TransactionUpdateRequest,
} from '@financas/api-types';
import backendApi, { changedTags } from '../../api/backendApi';
import send from '../../api/send';
import type { Period } from '../../kit/periodBar/periodBar';
import type { LedgerQuery } from './flows/browseTransactions/ledgerFilters';

// The Manage Finances Experience's own endpoints (X6; OQ-220, OQ-221,
// OQ-222): the ledger, the Month Overview report, the Goals' progress a
// trade's split names, an account's Holdings with one Holding's split and
// schedule, and the three writes. The ledger is an infinite query keyed by
// the applied filters; a write that went through — or a delete of a row
// already gone (`transaction.not_found`) — invalidates the ledger, the month
// and the Goals' progress, so every loaded page is fetched again and the
// figures stay the server's. The accounts and categories it shares with
// Account Setup are in `api/setupApi.ts`.

/** The ledger's query, addressed to its household. */
export interface LedgerInput {
  readonly householdId: string;
  readonly query: LedgerQuery;
}

/** The month a report is for, addressed to its household. */
export interface MonthInput extends Period {
  readonly householdId: string;
}

/** What addresses a Holding inside its household. */
export interface HoldingTarget {
  readonly householdId: string;
  readonly holdingId: string;
}

/** What addresses a transaction inside its household. */
export interface TransactionTarget {
  readonly householdId: string;
  readonly transactionId: string;
}

/** A record, addressed to its household. */
export interface RecordInput {
  readonly householdId: string;
  readonly request: TransactionCreateRequest;
}

/** An edit's changes, addressed to its transaction. */
export interface SaveInput extends TransactionTarget {
  readonly changes: TransactionUpdateRequest;
}

/** The Experience's own caches, which a transaction write makes stale. */
const WRITE_TAGS = ['Ledger', 'MonthOverview'] as const;

/** The code of a delete whose row is already gone: the ledger is stale too. */
const GONE = 'transaction.not_found';

/** Builds a household's path. */
const householdPath = (householdId: string) => `/households/${encodeURIComponent(householdId)}`;

/** Builds one Holding's path inside its household. */
const holdingPath = ({ householdId, holdingId }: HoldingTarget) => (
  `${householdPath(householdId)}/holdings/${encodeURIComponent(holdingId)}`);

/** Builds one transaction's path inside its household. */
const transactionPath = ({ householdId, transactionId }: TransactionTarget) => (
  `${householdPath(householdId)}/transactions/${encodeURIComponent(transactionId)}`);

/**
 * Builds a ledger page's address: each filter in use — a list comma-joined,
 * as the contract's `explode: false` asks — and the cursor after the first.
 *
 * @param input - The household and the filters' query.
 * @param cursor - The previous page's `nextCursor`; none for the first page.
 * @returns The page's path and search.
 */
export const ledgerPathOf = ({ householdId, query }: LedgerInput, cursor: string | null) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([name, value]) => {
    params.set(name, Array.isArray(value) ? value.join(',') : String(value));
  });
  if (cursor !== null) params.set('cursor', cursor);
  const search = params.toString();
  return `${householdPath(householdId)}/transactions${search === '' ? '' : `?${search}`}`;
};

/**
 * Names the caches a write makes stale: all of them once it went through, or
 * when it says its row is gone; none when it failed otherwise. The shared
 * accounts and goals too: it moved a balance, and a buy's split moves a
 * goal's funding (Account Setup shows both, PR #145).
 *
 * @param error - The write's failure, if any.
 * @returns The tags to invalidate.
 */
export const writeTagsOf = (error: unknown) => changedTags(
  [...WRITE_TAGS, 'Accounts', 'Goals'],
  error,
  GONE,
);

/** The Experience's slice of the backend API. */
export const manageFinancesApi = backendApi.enhanceEndpoints({
  addTagTypes: [...WRITE_TAGS],
}).injectEndpoints({
  endpoints: (build) => ({
    listTransactions: build.infiniteQuery<TransactionPage, LedgerInput, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg, pageParam }) => ledgerPathOf(queryArg, pageParam),
      providesTags: ['Ledger'],
    }),
    getMonthOverview: build.query<MonthOverviewReport, MonthInput>({
      query: ({ householdId, year, month }) => (
        `${householdPath(householdId)}/reports/month-overview?year=${year}&month=${month}`
      ),
      transformResponse: (response: GetReportResponse) => response as MonthOverviewReport,
      // Its balances, budgets and goals come from the household's setup data,
      // so a write in Account Setup makes it stale too (PR #145).
      providesTags: ['MonthOverview', 'Accounts', 'Budgets', 'Goals'],
    }),
    listHoldings: build.query<readonly InvestmentHolding[], {
      readonly householdId: string;
      readonly accountId: string;
    }>({
      query: ({ householdId, accountId }) => (
        `${householdPath(householdId)}/accounts/${encodeURIComponent(accountId)}/holdings`
      ),
      transformResponse: (response: ListHoldingsResponse) => response.data ?? [],
    }),
    getHolding: build.query<InvestmentHolding, HoldingTarget>({
      query: holdingPath,
    }),
    listHoldingAllocations: build.query<readonly HoldingAllocation[], HoldingTarget>({
      query: (target) => `${holdingPath(target)}/allocations`,
      transformResponse: (response: HoldingAllocations) => response.data,
    }),
    listScheduleEntries: build.query<readonly InvestmentScheduleEntry[], HoldingTarget>({
      query: (target) => `${holdingPath(target)}/schedule-entries`,
      transformResponse: (response: ListScheduleEntriesResponse) => response.data ?? [],
    }),
    recordTransaction: build.mutation<unknown, RecordInput>({
      query: ({ householdId, request }) => (
        send('POST', `${householdPath(householdId)}/transactions`, request)
      ),
      invalidatesTags: (_result, error) => writeTagsOf(error),
    }),
    saveTransaction: build.mutation<unknown, SaveInput>({
      query: ({ changes, ...target }) => send('PATCH', transactionPath(target), changes),
      invalidatesTags: (_result, error) => writeTagsOf(error),
    }),
    deleteTransaction: build.mutation<void, TransactionTarget>({
      query: (target) => send('DELETE', transactionPath(target)),
      invalidatesTags: (_result, error) => writeTagsOf(error),
    }),
  }),
});

export const {
  useListTransactionsInfiniteQuery,
  useGetMonthOverviewQuery,
  useLazyListHoldingsQuery,
  useGetHoldingQuery,
  useLazyGetHoldingQuery,
  useLazyListHoldingAllocationsQuery,
  useLazyListScheduleEntriesQuery,
  useRecordTransactionMutation,
  useSaveTransactionMutation,
  useDeleteTransactionMutation,
} = manageFinancesApi;
