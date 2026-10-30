import type { LedgerItem } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  holdingToReadFor, ledgerStatusOf, overviewReadOf, periodOf, splitGoalsOf, type LedgerQueryState,
} from '../../../../src/experiences/manageFinances/manageFinances';
import { goalOf, REPORT } from '../monthFixtures';

// What the Manage Finances Experience reads its queries into (BDT: unit —
// pure, nothing mocked).

describe('periodOf', () => {
  it('reads the month a date falls in', () => {
    expect(periodOf('2026-09-30')).toEqual({ year: 2026, month: 9 });
  });
});

/** An infinite query at rest with pages loaded; the case overrides the rest. */
const ledgerQuery = (over: Partial<LedgerQueryState> = {}): LedgerQueryState => ({
  pages: [{ items: [] }],
  isFetching: false,
  isFetchingNextPage: false,
  isError: false,
  isFetchNextPageError: false,
  ...over,
});

describe('ledgerStatusOf', () => {
  it.each<[string, Partial<LedgerQueryState>, string]>([
    ['at rest', {}, 'idle'],
    ['refetching after a write, the rows kept', { isFetching: true }, 'idle'],
    ['a failed refetch, the rows kept', { isError: true }, 'idle'],
    ['the first page out', { pages: undefined, isFetching: true }, 'loading'],
    ['the next page out', { isFetching: true, isFetchingNextPage: true }, 'loading'],
    ['the first page failed', { pages: undefined, isError: true }, 'error'],
    ['the next page failed', { isError: true, isFetchNextPageError: true }, 'error'],
  ])('reads %s', (_name, over, status) => {
    expect(ledgerStatusOf(ledgerQuery(over))).toBe(status);
  });
});

describe('overviewReadOf', () => {
  it('shows the month’s own report', () => {
    expect(overviewReadOf({ currentData: REPORT, isError: false })).toEqual({
      status: 'loaded', report: REPORT,
    });
  });

  it('loads while the month changes, and fails when it failed', () => {
    expect(overviewReadOf({ isError: false })).toEqual({ status: 'loading' });
    expect(overviewReadOf({ isError: true })).toEqual({ status: 'failed' });
  });
});

describe('splitGoalsOf', () => {
  it('lists the active Goals first, each with its own-currency progress rounded down', () => {
    const trip = {
      ...goalOf('trip', [
        {
          holdingId: 'aapl',
          name: 'AAPL',
          percentage: 10,
          contribution: { currency: 'USD', amount: 10000 },
        },
        {
          holdingId: 'cdb',
          name: 'CDB',
          percentage: 10,
          contribution: { currency: 'BRL', amount: 99999 },
        },
      ]),
      targetAmount: 30000,
    };
    const done = goalOf('car');
    expect(splitGoalsOf([trip], [done])).toEqual([
      {
        id: 'trip', name: trip.name, progress: 33, completed: false,
      },
      {
        id: 'car', name: done.name, progress: 0, completed: true,
      },
    ]);
  });
});

describe('holdingToReadFor', () => {
  const buy = {
    ledger: 'account', id: 't-1', kind: 'investment_buy', holdingId: 'h-1',
  } as LedgerItem;

  it('reads a buy’s Holding', () => {
    expect(holdingToReadFor(buy)).toBe('h-1');
  });

  it.each([
    ['a buy with no Holding', { ...buy, holdingId: null }],
    ['a sell', { ...buy, kind: 'investment_sell' }],
    ['a row with no kind', { ...buy, kind: undefined }],
    ['a card row', { ledger: 'card', id: 't-2', kind: 'card_charge' }],
  ])('reads nothing for %s', (_name, item) => {
    expect(holdingToReadFor(item as LedgerItem)).toBeUndefined();
  });
});
