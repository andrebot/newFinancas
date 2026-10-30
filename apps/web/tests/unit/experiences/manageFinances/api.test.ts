import { describe, expect, it } from 'vitest';
import {
  ledgerPathOf, manageFinancesApi, writeTagsOf,
} from '../../../../src/experiences/manageFinances/api';
import { goalsApi } from '../../../../src/api/goalsApi';
import { setupApi } from '../../../../src/api/setupApi';
import { envelope, jsonResponse } from '../../api/fakes';
import { fakeFetch, sent, settle } from '../experienceFakes';
import { fakeStore } from '../../shell/shellFakes';

// The Manage Finances Experience's own endpoints (BDT: unit): the ledger's
// address and the caches a write makes stale, then each read through the real
// store and API client — only `fetch` is fake — for its route and what it
// hands back. The writes and the infinite query run in the Experience's suite.

describe('ledgerPathOf', () => {
  it('asks for the first page with no filter', () => {
    expect(ledgerPathOf({ householdId: 'doe', query: {} }, null))
      .toBe('/households/doe/transactions');
  });

  it('joins each list, sets each value and adds the cursor', () => {
    const path = ledgerPathOf({
      householdId: 'd o',
      query: {
        kinds: ['expense', 'income'], categoryIds: ['food'], holdingId: 'h-1', from: '2026-09-01',
      },
    }, 'c-2');
    const url = new URL(path, 'http://app.test');
    expect(url.pathname).toBe('/households/d%20o/transactions');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      kinds: 'expense,income',
      categoryIds: 'food',
      holdingId: 'h-1',
      from: '2026-09-01',
      cursor: 'c-2',
    });
  });
});

describe('writeTagsOf', () => {
  it('makes the ledger, the month, the balances and the Goals stale after a write', () => {
    expect(writeTagsOf(undefined)).toEqual(['Ledger', 'MonthOverview', 'Accounts', 'Goals']);
  });

  it('does so too when the row is already gone', () => {
    expect(writeTagsOf({ code: 'transaction.not_found' })).toHaveLength(4);
  });

  it.each([
    ['another refusal', { code: 'transaction.changed' }],
    ['an exception', { message: 'boom' }],
    ['a bare value', 'boom'],
    ['null', null],
  ])('changes nothing after %s', (_name, error) => {
    expect(writeTagsOf(error)).toEqual([]);
  });
});

/** A started read: awaitable, and let go once done. */
type Running = PromiseLike<unknown> & { unsubscribe: () => void };

/**
 * Runs one read through the real store.
 *
 * @param route - The `METHOD path` it answers.
 * @param body - The answer's body.
 * @param start - Starts the read on the store.
 * @returns What the read resolved to, and the address it asked.
 */
const read = async (
  route: string,
  body: unknown,
  start: (store: ReturnType<typeof fakeStore>['store']) => Running,
) => {
  const fetchFn = fakeFetch({ [route]: () => jsonResponse(200, body) });
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  const running = start(store);
  const result = await running;
  running.unsubscribe();
  const [input] = fetchFn.mock.calls[0] ?? [];
  return { result, url: new URL((input as Request).url) };
};

describe('the reads', () => {
  it('asks for one month’s overview', async () => {
    const { result, url } = await read(
      'GET /households/doe/reports/month-overview',
      { reportType: 'month-overview', budgets: [] },
      (store) => store.dispatch(manageFinancesApi.endpoints.getMonthOverview.initiate({
        householdId: 'doe', year: 2026, month: 9,
      })),
    );
    expect(url.search).toBe('?year=2026&month=9');
    expect(result).toEqual(expect.objectContaining({
      data: { reportType: 'month-overview', budgets: [] },
    }));
  });

  it.each([
    ['listHoldings', 'GET /households/doe/accounts/inv/holdings', {
      householdId: 'doe', accountId: 'inv',
    }],
    ['listScheduleEntries', 'GET /households/doe/holdings/h-1/schedule-entries', {
      householdId: 'doe', holdingId: 'h-1',
    }],
  ] as const)('reads %s out of its envelope', async (endpoint, route, arg) => {
    const { result } = await read(route, { data: [{ id: 'x' }] }, (store) => store.dispatch(
      // Each endpoint takes its own argument, given alongside it above.
      (manageFinancesApi.endpoints[endpoint].initiate as (input: unknown) => never)(arg),
    ) as unknown as Running);
    expect(result).toEqual(expect.objectContaining({ data: [{ id: 'x' }] }));
  });

  it.each([
    ['listHoldings', 'GET /households/doe/accounts/inv/holdings', {
      householdId: 'doe', accountId: 'inv',
    }],
    ['listScheduleEntries', 'GET /households/doe/holdings/h-1/schedule-entries', {
      householdId: 'doe', holdingId: 'h-1',
    }],
  ] as const)('reads %s with no list as none', async (endpoint, route, arg) => {
    const { result } = await read(route, {}, (store) => store.dispatch(
      (manageFinancesApi.endpoints[endpoint].initiate as (input: unknown) => never)(arg),
    ) as unknown as Running);
    expect(result).toEqual(expect.objectContaining({ data: [] }));
  });

  it('reads a Holding’s split and the Holding itself', async () => {
    const split = await read(
      'GET /households/doe/holdings/h-1/allocations',
      { data: [{ goalId: 'trip', percentage: 100 }] },
      (store) => store.dispatch(manageFinancesApi.endpoints.listHoldingAllocations.initiate({
        householdId: 'doe', holdingId: 'h-1',
      })),
    );
    expect(split.result).toEqual(expect.objectContaining({
      data: [{ goalId: 'trip', percentage: 100 }],
    }));
    const holding = await read(
      'GET /households/doe/holdings/h-1',
      { id: 'h-1', ticker: 'BBAS3' },
      (store) => store.dispatch(manageFinancesApi.endpoints.getHolding.initiate({
        householdId: 'doe', holdingId: 'h-1',
      })),
    );
    expect(holding.result).toEqual(expect.objectContaining({
      data: { id: 'h-1', ticker: 'BBAS3' },
    }));
  });

  it('hands a refusal back as the error', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/holdings/h-1': () => jsonResponse(404, envelope('holding.not_found')),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const running = store.dispatch(manageFinancesApi.endpoints.getHolding.initiate({
      householdId: 'doe', holdingId: 'h-1',
    }));
    expect((await running).error).toEqual(expect.objectContaining({ code: 'holding.not_found' }));
    running.unsubscribe();
  });
});

describe('the month overview', () => {
  it.each([
    ['a budget delete', (store: ReturnType<typeof fakeStore>['store']) => store.dispatch(
      setupApi.endpoints.deleteBudget.initiate({ householdId: 'doe', budgetId: 'fun' }),
    )],
    ['an account edit', (store: ReturnType<typeof fakeStore>['store']) => store.dispatch(
      setupApi.endpoints.editAccount.initiate({ householdId: 'doe', accountId: 'chk', name: 'X' }),
    )],
    ['a goal completed', (store: ReturnType<typeof fakeStore>['store']) => store.dispatch(
      goalsApi.endpoints.completeGoal.initiate({ householdId: 'doe', goalId: 'trip' }),
    )],
  ])('is read again after %s in Account Setup (PR #145)', async (_write, write) => {
    const fetchFn = fakeFetch({
      'GET /households/doe/reports/month-overview': () => jsonResponse(200, { budgets: [] }),
      'DELETE /households/doe/budgets/fun': () => jsonResponse(204),
      'PATCH /households/doe/accounts/chk': () => jsonResponse(200, { id: 'chk' }),
      'POST /households/doe/goals/trip/complete': () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const month = store.dispatch(manageFinancesApi.endpoints.getMonthOverview.initiate({
      householdId: 'doe', year: 2026, month: 10,
    }));
    await month;
    await write(store);
    await settle();
    const reads = (await sent(fetchFn))
      .filter(({ route }) => route.startsWith('GET /api/v1/households/doe/reports'));
    expect(reads).toHaveLength(2);
    month.unsubscribe();
  });
});

describe('the goals\' progress', () => {
  it('is read again after a transaction write (a buy\'s split moves it, PR #145)', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/goal-progress': () => jsonResponse(200, { data: [] }),
      'DELETE /households/doe/transactions/t-1': () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const progress = store.dispatch(goalsApi.endpoints.listGoalProgress.initiate({
      householdId: 'doe', status: 'active',
    }));
    await progress;
    await store.dispatch(manageFinancesApi.endpoints.deleteTransaction.initiate({
      householdId: 'doe', transactionId: 't-1',
    }));
    await settle();
    const reads = (await sent(fetchFn))
      .filter(({ route }) => route.startsWith('GET /api/v1/households/doe/goal-progress'));
    expect(reads).toHaveLength(2);
    progress.unsubscribe();
  });
});
