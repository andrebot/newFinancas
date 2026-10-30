import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { skipToken } from '@reduxjs/toolkit/query/react';
import type { LedgerItem } from '@financas/api-types';
import { toRequestOutcome } from '../../api/outcome';
import { manageFinances } from '../../config/constants';
import type { RequestOutcome } from '../../utilities/requestOutcome';
import {
  useDeleteTransactionMutation, useGetHoldingQuery, useListTransactionsInfiniteQuery,
} from './api';
import { NO_FILTERS, queryOf, type LedgerFilters } from './flows/browseTransactions/ledgerFilters';
import type { LoadedLedger } from './flows/browseTransactions/ledgerPages';
import { ledgerStatusOf } from './manageFinances';

// The ledger the Manage Finances Experience holds for Browse Transactions (X6,
// OQ-220, OQ-222): the applied filters, the pages for them — an infinite
// query keyed by the filters, refetched whole after every write — the filter
// drawer's open state and the delete. A Holding filter lives in the address
// (`?holding=<id>`, what a Holding's "See in Transactions" links to), so it
// survives a reload; the other filters are this page's state alone. The
// Holding's chip is named by its ticker, read once the filter is set. A
// Holding belongs to the household the page opened in: after a household
// switch the parameter is ignored and dropped (PR #145 review).

/** What the page holds of the ledger, as Browse Transactions takes it. */
export interface LedgerSource {
  readonly filters: LedgerFilters;
  readonly onFiltersChange: (filters: LedgerFilters) => void;
  readonly ledger: LoadedLedger;
  readonly onReachedEnd: () => void;
  readonly holdingName: string | undefined;
  readonly filterOpen: boolean;
  readonly onFilterOpen: () => void;
  readonly onFilterClose: () => void;
  readonly onDelete: (item: LedgerItem) => Promise<RequestOutcome>;
}

/**
 * Holds the Holding filter in the address: read from it, and written back by
 * replacing the entry, so a removed chip leaves no history behind. One left
 * from another household is ignored and dropped.
 *
 * @param fromThisHousehold - Whether the address's Holding is this household's.
 * @returns The Holding's id, if any, and its setter.
 */
const useHoldingParam = (fromThisHousehold: boolean) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const inAddress = searchParams.get(manageFinances.holdingParam) ?? undefined;
  const holdingId = fromThisHousehold ? inAddress : undefined;

  /**
   * Sets or drops the Holding filter, keeping the address's other parameters.
   *
   * @param next - The Holding's id, or nothing to drop it.
   */
  const setHoldingId = useCallback((next: string | undefined) => {
    if (next === inAddress) return;
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next === undefined) params.delete(manageFinances.holdingParam);
      else params.set(manageFinances.holdingParam, next);
      return params;
    }, { replace: true });
  }, [inAddress, setSearchParams]);

  const stale = !fromThisHousehold && inAddress !== undefined;
  useEffect(() => {
    if (stale) setHoldingId(undefined);
  }, [stale, setHoldingId]);

  return { holdingId, setHoldingId };
};

/**
 * Holds the ledger for one household.
 *
 * @param householdId - The household.
 * @param holdingFromAddress - Whether the address's Holding is this household's:
 *   it is the household the page opened in.
 * @returns The filters, the pages and the Flow's handlers.
 */
export default function useLedger(householdId: string, holdingFromAddress: boolean): LedgerSource {
  const { holdingId, setHoldingId } = useHoldingParam(holdingFromAddress);
  const [others, setOthers] = useState<LedgerFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filters: LedgerFilters = { ...others, holdingId };
  const query = useListTransactionsInfiniteQuery({ householdId, query: queryOf(filters) });
  const holding = useGetHoldingQuery(
    holdingId === undefined ? skipToken : { householdId, holdingId },
  );
  const [deleteTransaction] = useDeleteTransactionMutation();
  const pages = query.currentData?.pages;

  return {
    filters,
    onFiltersChange: ({ holdingId: nextHolding, ...rest }) => {
      setOthers({ ...rest, holdingId: undefined });
      setHoldingId(nextHolding);
    },
    ledger: {
      pages: pages ?? [],
      hasMore: query.hasNextPage,
      status: ledgerStatusOf({ ...query, pages }),
    },
    // A failed refetch (after a write) is retried whole; otherwise the next page.
    onReachedEnd: () => {
      if (query.isError && !query.isFetchNextPageError) query.refetch();
      else query.fetchNextPage();
    },
    holdingName: holding.currentData?.ticker ?? undefined,
    filterOpen,
    onFilterOpen: () => setFilterOpen(true),
    onFilterClose: () => setFilterOpen(false),
    // The server always sends a row's id; the contract leaves it optional.
    onDelete: async (item) => toRequestOutcome(
      await deleteTransaction({ householdId, transactionId: item.id as string }),
    ),
  };
}
