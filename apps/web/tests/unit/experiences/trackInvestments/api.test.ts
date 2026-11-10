import { describe, expect, it } from 'vitest';
import { goalsApi } from '../../../../src/api/goalsApi';
import { manageFinancesApi } from '../../../../src/experiences/manageFinances/api';
import {
  activityPathOf, payoutsPathOf, trackInvestmentsApi,
} from '../../../../src/experiences/trackInvestments/api';
import { jsonResponse } from '../../api/fakes';
import { fakeFetch, sent, settle } from '../experienceFakes';
import { fakeStore } from '../../shell/shellFakes';

// The Track Investments Experience's own endpoints (BDT: unit): the payouts'
// and the activity's addresses, then each read and write through the real
// store and API client — only `fetch` is fake — for its route, what it hands
// back and what it makes stale (OQ-233..236).

type Store = ReturnType<typeof fakeStore>['store'];

/** A started read: awaitable, and let go once done. */
type Running = PromiseLike<unknown> & { unsubscribe: () => void };

const HOLDING = { householdId: 'doe', holdingId: 'h-1' };

describe('payoutsPathOf', () => {
  it('asks for every Holding when none is chosen', () => {
    expect(payoutsPathOf({ householdId: 'd o', holdingIds: undefined, months: 12 }))
      .toBe('/households/d%20o/reports/payouts?months=12');
  });

  it('joins the chosen Holdings with commas (explode: false)', () => {
    const url = new URL(
      payoutsPathOf({ householdId: 'doe', holdingIds: ['a', 'b'], months: 3 }),
      'http://app.test',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({ months: '3', holdingIds: 'a,b' });
  });
});

describe('activityPathOf', () => {
  it('asks the ledger for the Holding\'s latest transactions', () => {
    expect(activityPathOf(HOLDING)).toBe('/households/doe/transactions?holdingId=h-1&limit=3');
  });
});

/**
 * Runs one read through the real store.
 *
 * @param route - The `METHOD path` it answers.
 * @param body - The answer's body.
 * @param start - Starts the read on the store.
 * @returns What the read resolved to, and the address it asked.
 */
const read = async (route: string, body: unknown, start: (store: Store) => Running) => {
  const fetchFn = fakeFetch({ [route]: () => jsonResponse(200, body) });
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  const running = start(store);
  const result = await running;
  running.unsubscribe();
  const [input] = fetchFn.mock.calls[0] ?? [];
  return { result, url: new URL((input as Request).url) };
};

/** Starts any of the Experience's reads with its own argument. */
const start = (endpoint: keyof typeof trackInvestmentsApi.endpoints, arg: unknown) => (
  store: Store,
) => store.dispatch(
  (trackInvestmentsApi.endpoints[endpoint].initiate as (input: unknown) => never)(arg),
) as unknown as Running;

describe('the reads', () => {
  it.each([
    ['getInvestmentsOverview', 'GET /households/doe/reports/investments-overview', 'doe'],
    ['getPayouts', 'GET /households/doe/reports/payouts', {
      householdId: 'doe', holdingIds: undefined, months: 12,
    }],
  ] as const)('reads %s as the report itself', async (endpoint, route, arg) => {
    const { result } = await read(route, { reportType: 'x' }, start(endpoint, arg));
    expect(result).toEqual(expect.objectContaining({ data: { reportType: 'x' } }));
  });

  it('reads the household\'s Holdings, archived ones included (OQ-233)', async () => {
    const { result, url } = await read(
      'GET /households/doe/holdings',
      { data: [{ id: 'h-1' }] },
      start('listHouseholdHoldings', 'doe'),
    );
    expect(url.search).toBe('?includeArchived=true');
    expect(result).toEqual(expect.objectContaining({ data: [{ id: 'h-1' }] }));
  });

  it.each([
    ['listHouseholdHoldings', 'GET /households/doe/holdings', 'doe'],
    ['listValuationSnapshots', 'GET /households/doe/holdings/h-1/valuation-snapshots', HOLDING],
  ] as const)('reads %s with no list as none', async (endpoint, route, arg) => {
    const { result } = await read(route, {}, start(endpoint, arg));
    expect(result).toEqual(expect.objectContaining({ data: [] }));
  });

  it.each([
    ['listIndexRates', 'GET /households/doe/index-rates', 'doe'],
    ['listHoldingSplit', 'GET /households/doe/holdings/h-1/allocations', HOLDING],
    ['listValuationSnapshots', 'GET /households/doe/holdings/h-1/valuation-snapshots', HOLDING],
  ] as const)('reads %s out of its envelope', async (endpoint, route, arg) => {
    const { result } = await read(route, { data: [{ id: 'x' }] }, start(endpoint, arg));
    expect(result).toEqual(expect.objectContaining({ data: [{ id: 'x' }] }));
  });

  it('reads a Holding\'s activity as the page\'s items, none when it has none', async () => {
    const route = 'GET /households/doe/transactions';
    const activity = start('listHoldingActivity', HOLDING);
    const items = await read(route, { items: [{ id: 't-1' }] }, activity);
    expect(items.result).toEqual(expect.objectContaining({ data: [{ id: 't-1' }] }));
    const none = await read(route, {}, activity);
    expect(none.result).toEqual(expect.objectContaining({ data: [] }));
  });
});

/** Every route a write test may touch, answered. */
const WRITE_ANSWERS = {
  'GET /households/doe/reports/investments-overview': () => jsonResponse(200, {}),
  'GET /households/doe/holdings': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/index-rates': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/goal-progress': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/holdings/h-1/valuation-snapshots': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/holdings/h-1/allocations': () => jsonResponse(200, { data: [] }),
  'PATCH /households/doe/holdings/h-1': () => jsonResponse(200, { data: [] }),
  'POST /households/doe/holdings/h-1/valuation-snapshots': () => jsonResponse(201, {}),
  'PATCH /households/doe/holdings/h-1/valuation-snapshots/s-1': () => jsonResponse(200, {}),
  'DELETE /households/doe/holdings/h-1/valuation-snapshots/s-1': () => jsonResponse(204),
  'POST /households/doe/index-rates/cdi/values': () => jsonResponse(201, {}),
  'PATCH /households/doe/index-rates/cdi/values/v-1': () => jsonResponse(200, {}),
  'DELETE /households/doe/index-rates/cdi/values/v-1': () => jsonResponse(404, {
    error: { code: 'index_rate.not_found', message: 'x', correlationId: 'c' },
  }),
  'DELETE /households/doe/transactions/t-1': () => jsonResponse(204),
};

/**
 * Reads some of the page's data, makes a write, and counts each read's requests.
 *
 * @param reads - The reads to start, each with its route prefix.
 * @param write - The write.
 * @returns How many times each route prefix was asked for, by prefix.
 */
const readsAfter = async (
  reads: readonly (readonly [string, (store: Store) => Running])[],
  write: (store: Store) => PromiseLike<unknown>,
) => {
  const fetchFn = fakeFetch(WRITE_ANSWERS);
  const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
  const running = reads.map(([, begin]) => begin(store));
  await Promise.all(running);
  await write(store);
  await settle();
  const routes = (await sent(fetchFn)).map(({ route }) => route);
  running.forEach((query) => query.unsubscribe());
  return Object.fromEntries(reads.map(([prefix]) => [
    prefix, routes.filter((route) => route === `GET /api/v1${prefix}`).length,
  ]));
};

const OVERVIEW = [
  '/households/doe/reports/investments-overview', start('getInvestmentsOverview', 'doe'),
] as const;
const HOLDINGS = ['/households/doe/holdings', start('listHouseholdHoldings', 'doe')] as const;
const RATES = ['/households/doe/index-rates', start('listIndexRates', 'doe')] as const;
const SNAPSHOTS = [
  '/households/doe/holdings/h-1/valuation-snapshots', start('listValuationSnapshots', HOLDING),
] as const;
const SPLIT = [
  '/households/doe/holdings/h-1/allocations', start('listHoldingSplit', HOLDING),
] as const;
const PROGRESS = ['/households/doe/goal-progress', (store: Store) => store.dispatch(
  goalsApi.endpoints.listGoalProgress.initiate({ householdId: 'doe', status: 'active' }),
)] as const;

describe('a rate write (OQ-235)', () => {
  it.each([
    ['a record', (store: Store) => store.dispatch(trackInvestmentsApi.endpoints.recordIndexRate
      .initiate({
        householdId: 'doe', index: 'cdi', value: 1, asOf: '2026-10-01',
      }))],
    ['an edit', (store: Store) => store.dispatch(trackInvestmentsApi.endpoints.editIndexRate
      .initiate({
        householdId: 'doe', index: 'cdi', valueId: 'v-1', value: 1, asOf: '2026-10-01',
      }))],
    ['a delete of a value already gone', (store: Store) => store.dispatch(
      trackInvestmentsApi.endpoints.deleteIndexRate.initiate({
        householdId: 'doe', index: 'cdi', valueId: 'v-1',
      }),
    )],
  ])('reads the rates, the overview and the Holdings again after %s', async (_name, write) => {
    expect(await readsAfter([OVERVIEW, HOLDINGS, RATES, SNAPSHOTS], write)).toEqual({
      [OVERVIEW[0]]: 2, [HOLDINGS[0]]: 2, [RATES[0]]: 2, [SNAPSHOTS[0]]: 1,
    });
  });
});

describe('a market value write', () => {
  it.each([
    ['a record', (store: Store) => store.dispatch(trackInvestmentsApi.endpoints.recordMarketValue
      .initiate({ ...HOLDING, value: 100, asOf: '2026-10-01' }))],
    ['an edit', (store: Store) => store.dispatch(trackInvestmentsApi.endpoints.editMarketValue
      .initiate({
        ...HOLDING, snapshotId: 's-1', value: 100, asOf: '2026-10-01',
      }))],
    ['a delete', (store: Store) => store.dispatch(trackInvestmentsApi.endpoints.deleteMarketValue
      .initiate({ ...HOLDING, snapshotId: 's-1' }))],
  ])('reads the history, the overview and the Goals again after %s', async (_name, write) => {
    expect(await readsAfter([OVERVIEW, SNAPSHOTS, PROGRESS, RATES], write)).toEqual({
      [OVERVIEW[0]]: 2, [SNAPSHOTS[0]]: 2, [PROGRESS[0]]: 2, [RATES[0]]: 1,
    });
  });

  it('sends the value and its date', async () => {
    const fetchFn = fakeFetch(WRITE_ANSWERS);
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    await store.dispatch(trackInvestmentsApi.endpoints.editMarketValue.initiate({
      ...HOLDING, snapshotId: 's-1', value: 100, asOf: '2026-10-01',
    }));
    const [request] = await sent(fetchFn);
    expect(request?.body).toEqual({ value: 100, asOf: '2026-10-01' });
  });
});

describe('a split write', () => {
  it('reads the split and the Goals\' progress again, sending the split', async () => {
    const write = (store: Store) => store.dispatch(trackInvestmentsApi.endpoints
      .saveHoldingAllocations.initiate({
        ...HOLDING, allocations: [{ goalId: 'trip', percentage: 50 }],
      }));
    expect(await readsAfter([SPLIT, PROGRESS, OVERVIEW], write)).toEqual({
      [SPLIT[0]]: 2, [PROGRESS[0]]: 2, [OVERVIEW[0]]: 2,
    });
  });
});

describe('a transaction recorded in Manage Finances', () => {
  it('reads the overview and the Holdings again (PR #145)', async () => {
    const write = (store: Store) => store.dispatch(manageFinancesApi.endpoints.deleteTransaction
      .initiate({ householdId: 'doe', transactionId: 't-1' }));
    expect(await readsAfter([OVERVIEW, HOLDINGS, RATES], write)).toEqual({
      [OVERVIEW[0]]: 2, [HOLDINGS[0]]: 2, [RATES[0]]: 1,
    });
  });
});
