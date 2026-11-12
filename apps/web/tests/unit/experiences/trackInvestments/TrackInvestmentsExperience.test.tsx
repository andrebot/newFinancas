import { act, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { HoldingMaintenanceFlowProps } from '../../../../src/experiences/trackInvestments/flows/holdingMaintenance/HoldingMaintenanceFlow';
import type { PortfolioOverviewFlowProps } from '../../../../src/experiences/trackInvestments/flows/portfolioOverview/PortfolioOverviewFlow';
import type { RatesMaintenanceFlowProps } from '../../../../src/experiences/trackInvestments/flows/ratesMaintenance/RatesMaintenanceFlow';
import TrackInvestmentsExperience from '../../../../src/experiences/trackInvestments/TrackInvestmentsExperience';
import { householdChosen, switchHousehold } from '../../../../src/shell/shellState';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  fakeFetch, outcomeOf, press, sent, settle, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { goalOf } from '../monthFixtures';
import {
  HOLDINGS, INVESTMENT_ACCOUNTS, OVERVIEW, PAYOUTS,
} from '../portfolioFixtures';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// The Track Investments Experience (BDT: integration). Its three Flows are
// stubs — one button per request or event the Experience answers, and the
// props worth asserting shown as JSON; Holding Maintenance's stub opens a row
// through the real `details` slot. Beneath them, the real store and API
// client — only `fetch` is fake.

vi.mock(
  '../../../../src/experiences/trackInvestments/flows/portfolioOverview/PortfolioOverviewFlow',
  () => ({
    /**
     * Portfolio Overview's stand-in.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    PortfolioOverviewFlow: ({
      overview, onRetry, accounts, goals, payouts,
    }: PortfolioOverviewFlowProps) => (
      <Stub
        name="overview"
        shows={{
          overview: overview.status,
          accounts: accounts.length,
          goals: goals?.length ?? null,
          payouts: payouts.read.status,
          chosen: payouts.chosen,
          currency: payouts.currencyMemory.read(),
        }}
        events={{
          retry: onRetry,
          retryPayouts: payouts.onRetry,
          chooseTwo: () => payouts.onChosenChange(['xpml11', 'vale3']),
          rememberCurrency: () => payouts.currencyMemory.write('USD'),
        }}
      />
    ),
  }),
);

/**
 * Holding Maintenance's stand-in: shows its props and opens a row through the
 * Experience's `details` slot.
 *
 * @param props - What the Experience passes.
 * @returns The stub, with the open row's details.
 */
function HoldingMaintenanceStub({
  overview, onRetry, accounts, goals, indexRates, viewer, details, requests,
}: HoldingMaintenanceFlowProps) {
  const [open, setOpen] = useState<string>();
  const holding = HOLDINGS.find(({ id }) => id === open);
  return (
    <>
      <Stub
        name="holdings"
        shows={{
          overview: overview.status,
          accounts: accounts.length,
          goals,
          indexRates: indexRates?.length ?? null,
          viewer,
        }}
        requests={{
          saveSplit: () => requests.onSaveAllocations('vale3', [
            { goalId: 'trip', percentage: 50 },
          ]),
          recordValue: () => requests.onRecordValue('vale3', {
            asOfDate: '2026-09-30', valuation: 12_300,
          }),
          editValue: () => requests.onEditValue('vale3', 's-1', {
            asOfDate: '2026-09-29', valuation: 12_000,
          }),
          deleteValue: () => requests.onDeleteValue('vale3', 's-1'),
        }}
        events={{
          retry: onRetry,
          openStock: () => setOpen('vale3'),
          openTesouro: () => setOpen('ipca35'),
          seeTransactions: () => requests.onSeeTransactions('vale3'),
        }}
      />
      {holding && details(holding, (read) => (
        <Stub
          name="details"
          shows={{
            allocations: read.allocations.status,
            snapshots: read.snapshots.status,
            activity: read.activity.status === 'ready' ? read.activity.data.length : 'loading',
          }}
        />
      ))}
    </>
  );
}

vi.mock(
  '../../../../src/experiences/trackInvestments/flows/holdingMaintenance/HoldingMaintenanceFlow',
  () => ({ HoldingMaintenanceFlow: HoldingMaintenanceStub }),
);

vi.mock(
  '../../../../src/experiences/trackInvestments/flows/ratesMaintenance/RatesMaintenanceFlow',
  () => ({
    /**
     * Rates Maintenance's stand-in.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    RatesMaintenanceFlow: ({
      rates, holdings, recorders, viewer, requests,
    }: RatesMaintenanceFlowProps) => (
      <Stub
        name="rates"
        shows={{
          rates: rates.status,
          holdings: holdings?.length ?? null,
          recorders: recorders?.map(({ firstName }) => firstName) ?? null,
          viewer,
        }}
        requests={{
          recordRate: () => requests.onRecord('cdi', { value: 105_000, asOf: '2026-10-01' }),
          editRate: () => requests.onEdit('cdi', 'v-1', { value: 104_000, asOf: '2026-09-30' }),
          deleteRate: () => requests.onDelete('cdi', 'v-1'),
        }}
      />
    ),
  }),
);

const USER = {
  id: 'jane',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: '2024-01-01T00:00:00Z',
  preferences: { theme: 'dark', language: 'en-US' },
};

const DOE = {
  id: 'doe', name: 'The Doe Household', createdAt: '2025-03-01T00:00:00Z', role: 'Member',
};
const RIVERA = { ...DOE, id: 'rivera', name: 'The Riveras' };

const MEMBER = {
  userId: 'jane',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'Member',
  joinedAt: '2025-03-01T00:00:00Z',
};

/** Answers for a page that loads: Jane, a Member of Doe, and every read. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: [DOE, RIVERA] }),
  'GET /households/doe/accounts': () => jsonResponse(200, { data: INVESTMENT_ACCOUNTS }),
  'GET /households/doe/reports/investments-overview': () => jsonResponse(200, OVERVIEW),
  'GET /households/doe/reports/payouts': () => jsonResponse(200, PAYOUTS),
  'GET /households/doe/holdings': () => jsonResponse(200, { data: HOLDINGS }),
  'GET /households/doe/goal-progress': (request) => jsonResponse(200, {
    data: [goalOf(new URL(request.url).searchParams.get('status') ?? '')],
  }),
  'GET /households/doe/index-rates': () => jsonResponse(200, {
    data: [{ index: 'cdi', unit: 'annual_percent', values: [] }],
  }),
  'GET /households/doe/members': () => jsonResponse(200, { data: [MEMBER] }),
  'GET /households/doe/holdings/vale3/allocations': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/holdings/ipca35/allocations': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/holdings/vale3/valuation-snapshots': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/transactions': () => jsonResponse(200, {
    items: [{ ledger: 'account', id: 't-1', kind: 'investment_buy' }],
  }),
  'PATCH /households/doe/holdings/vale3': () => jsonResponse(200, { data: [] }),
  'POST /households/doe/holdings/vale3/valuation-snapshots': () => jsonResponse(201, {}),
  'PATCH /households/doe/holdings/vale3/valuation-snapshots/s-1': () => jsonResponse(200, {}),
  'DELETE /households/doe/holdings/vale3/valuation-snapshots/s-1': () => jsonResponse(
    404, (
      envelope('snapshot.not_found')
    ),
  ),
  'POST /households/doe/index-rates/cdi/values': () => jsonResponse(201, {}),
  'PATCH /households/doe/index-rates/cdi/values/v-1': () => jsonResponse(200, {}),
  'DELETE /households/doe/index-rates/cdi/values/v-1': () => jsonResponse(204),
};

/** The payouts' address the Experience asks for (with its search). */
const PAYOUTS_CALL = 'GET /households/doe/reports/payouts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 12));
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

/**
 * Renders the Experience over the real store, signed in with Doe active.
 *
 * @param answers - The API's answers, over the loaded page's.
 * @param path - The address it opens on.
 * @returns The fake `fetch` and the store.
 */
const renderExperience = async (answers: Answers = {}, path = '/investments') => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(<TrackInvestmentsExperience />, store, { path });
  await settle();
  await settle();
  return { fetchFn, store };
};

/**
 * Lists the addresses `fetch` was called with, search included.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's `METHOD path?search`.
 */
const calls = (fetchFn: ReturnType<typeof fakeFetch>) => fetchFn.mock.calls.map(([input]) => {
  const request = input as Request;
  const url = new URL(request.url);
  return `${request.method} ${url.pathname.replace('/api/v1', '')}${url.search}`;
});

/**
 * Counts the calls to one address since the test began.
 *
 * @param fetchFn - The fake `fetch`.
 * @param prefix - The start of `METHOD path?search`.
 * @returns How many there were.
 */
const countOf = (fetchFn: ReturnType<typeof fakeFetch>, prefix: string) => (
  calls(fetchFn).filter((call) => call.startsWith(prefix)).length
);

/**
 * Opens one of the page's tabs.
 *
 * @param name - The tab's label.
 */
const openTab = async (name: string) => {
  await act(async () => {
    screen.getByRole('radio', { name }).click();
  });
  await settle();
};

describe('the page', () => {
  it('opens on the overview, with the disabled v2 Portfolio Builders', async () => {
    await renderExperience();
    expect(screen.getByRole('heading', { level: 1, name: 'Investments' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Investments sections' })).toBeTruthy();
    expect(screen.getByText(/Net worth across every holding/)).toBeTruthy();
    const builders = screen.getAllByRole('button', { name: /Portfolio Builder/ });
    expect(builders.map((button) => [button.textContent, (button as HTMLButtonElement).disabled]))
      .toEqual([['FII Portfolio Builderv2', true], ['Stock Portfolio Builderv2', true]]);
    expect(builders[0]?.title).toBe('Coming in v2');
  });

  it('opens on the tab the address names, and keeps it in the address', async () => {
    await renderExperience({}, '/investments?tab=rates&from=bell');
    expect(screen.getByTestId('rates')).toBeTruthy();
    await openTab('Holdings by account');
    expect(screen.getByTestId('location').textContent)
      .toBe('/investments?tab=holdings&from=bell');
    expect(screen.queryByTestId('rates')).toBeNull();
    expect(screen.getByText(/one account at a time/)).toBeTruthy();
  });

  it('offers a retry when the user can\'t be loaded', async () => {
    await renderExperience({ 'GET /users/me': () => jsonResponse(500, envelope('internal')) });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('starts afresh when the household changes', async () => {
    const { store } = await renderExperience({
      'GET /households/rivera/reports/investments-overview': () => jsonResponse(200, OVERVIEW),
      'GET /households/rivera/holdings': () => jsonResponse(200, { data: [] }),
      'GET /households/rivera/accounts': () => jsonResponse(200, { data: [] }),
      'GET /households/rivera/goal-progress': () => jsonResponse(200, { data: [] }),
      'GET /households/rivera/reports/payouts': () => jsonResponse(200, PAYOUTS),
    });
    await act(async () => {
      store.dispatch(switchHousehold('rivera'));
    });
    await settle();
    await settle();
    expect(shownBy('overview')).toMatchObject({ accounts: 0, chosen: [] });
  });
});

describe('the overview tab (FL18)', () => {
  it('hands the overview, the accounts, the active Goals and the payouts once read', async () => {
    const { fetchFn } = await renderExperience();
    expect(shownBy('overview')).toEqual({
      overview: 'loaded',
      accounts: INVESTMENT_ACCOUNTS.length,
      goals: 1,
      payouts: 'loaded',
      chosen: HOLDINGS.map(({ id }) => id),
      currency: null,
    });
    expect(calls(fetchFn)).toContain('GET /households/doe/holdings?includeArchived=true');
    // Every Holding is asked as none at all (OQ-233).
    expect(calls(fetchFn)).toContain(`${PAYOUTS_CALL}?months=12`);
  });

  it('waits for every read before showing the overview', async () => {
    await renderExperience({ 'GET /households/doe/accounts': () => new Promise(() => {}) });
    expect(shownBy('overview')).toMatchObject({ overview: 'loading' });
  });

  it('fails as one when any read fails, and asks again only for what failed', async () => {
    let fail = true;
    const { fetchFn } = await renderExperience({
      'GET /households/doe/holdings': () => (
        fail ? jsonResponse(500, envelope('internal')) : jsonResponse(200, { data: HOLDINGS })
      ),
    });
    expect(shownBy('overview')).toMatchObject({ overview: 'failed' });
    fail = false;
    await press('retry');
    expect(shownBy('overview')).toMatchObject({ overview: 'loaded' });
    expect(countOf(fetchFn, 'GET /households/doe/holdings')).toBe(2);
    expect(countOf(fetchFn, 'GET /households/doe/reports/investments-overview')).toBe(1);
  });

  it('asks the payouts for the chosen Holdings and remembers them per household', async () => {
    const { fetchFn } = await renderExperience();
    await press('chooseTwo');
    expect(calls(fetchFn)).toContain(`${PAYOUTS_CALL}?months=12&holdingIds=xpml11%2Cvale3`);
    expect(shownBy('overview')).toMatchObject({ chosen: ['xpml11', 'vale3'] });
    expect(window.localStorage.getItem('financas.payouts.holdings.doe'))
      .toBe('["xpml11","vale3"]');
  });

  it('waits for the Holdings before asking for a remembered list choice', async () => {
    window.localStorage.setItem('financas.payouts.holdings.doe', '["vale3","gone"]');
    let answer: (response: Response) => void = () => {};
    const { fetchFn } = await renderExperience({
      'GET /households/doe/holdings': () => new Promise((done) => {
        answer = done;
      }),
    });
    expect(countOf(fetchFn, PAYOUTS_CALL)).toBe(0);
    expect(shownBy('overview')).toMatchObject({ payouts: 'loading', chosen: [] });
    await act(async () => answer(jsonResponse(200, { data: HOLDINGS })));
    await settle();
    // A remembered Holding that is gone is never asked for (OQ-233).
    expect(calls(fetchFn)).toContain(`${PAYOUTS_CALL}?months=12&holdingIds=vale3`);
  });

  it('keeps a choice made before the Holdings are read as a list', async () => {
    await renderExperience({ 'GET /households/doe/holdings': () => new Promise(() => {}) });
    await press('chooseTwo');
    expect(window.localStorage.getItem('financas.payouts.holdings.doe'))
      .toBe('["xpml11","vale3"]');
  });

  it('asks for the payouts again after they failed', async () => {
    let fail = true;
    const { fetchFn } = await renderExperience({
      'GET /households/doe/reports/payouts': () => (
        fail ? jsonResponse(500, envelope('internal')) : jsonResponse(200, PAYOUTS)
      ),
    });
    expect(shownBy('overview')).toMatchObject({ payouts: 'failed' });
    fail = false;
    await press('retryPayouts');
    expect(shownBy('overview')).toMatchObject({ payouts: 'loaded' });
    expect(countOf(fetchFn, PAYOUTS_CALL)).toBe(2);
  });

  it('remembers the payout chart\'s currency under its own key', async () => {
    await renderExperience();
    await press('rememberCurrency');
    expect(window.localStorage.getItem('financas.payouts.currency')).toBe('USD');
  });
});

describe('the holdings tab (FL19)', () => {
  it('hands the overview, every Goal a split names, the rates and the viewer', async () => {
    await renderExperience({}, '/investments?tab=holdings');
    expect(shownBy('holdings')).toEqual({
      overview: 'loaded',
      accounts: INVESTMENT_ACCOUNTS.length,
      goals: [
        {
          id: 'active', name: expect.any(String), progress: expect.any(Number), completed: false,
        },
        {
          id: 'completed', name: expect.any(String), progress: expect.any(Number), completed: true,
        },
      ],
      indexRates: 1,
      viewer: { selfUserId: 'jane', role: 'Member' },
    });
  });

  it('reads an open market-priced Holding\'s split, values and latest trades', async () => {
    const { fetchFn } = await renderExperience({}, '/investments?tab=holdings');
    await press('openStock');
    expect(shownBy('details')).toEqual({ allocations: 'ready', snapshots: 'ready', activity: 1 });
    expect(calls(fetchFn)).toEqual(expect.arrayContaining([
      'GET /households/doe/holdings/vale3/allocations',
      'GET /households/doe/holdings/vale3/valuation-snapshots',
      'GET /households/doe/transactions?holdingId=vale3&limit=3',
    ]));
  });

  it('reads only an open fixed-term Holding\'s split (OQ-234)', async () => {
    const { fetchFn } = await renderExperience({}, '/investments?tab=holdings');
    await press('openTesouro');
    expect(shownBy('details')).toEqual({ allocations: 'ready', snapshots: 'ready', activity: 0 });
    expect(countOf(fetchFn, 'GET /households/doe/holdings/ipca35/valuation-snapshots')).toBe(0);
    expect(countOf(fetchFn, 'GET /households/doe/transactions')).toBe(0);
  });

  it.each([
    ['saveSplit', 'PATCH', '/holdings/vale3', {
      allocations: [{ goalId: 'trip', percentage: 50 }],
    }, { ok: true }],
    ['recordValue', 'POST', '/holdings/vale3/valuation-snapshots', {
      value: 12_300, asOf: '2026-09-30',
    }, { ok: true }],
    ['editValue', 'PATCH', '/holdings/vale3/valuation-snapshots/s-1', {
      value: 12_000, asOf: '2026-09-29',
    }, { ok: true }],
    ['deleteValue', 'DELETE', '/holdings/vale3/valuation-snapshots/s-1', undefined, {
      ok: false, error: { code: 'snapshot.not_found' },
    }],
  ])('sends %s and answers how it went', async (request, method, path, body, outcome) => {
    const { fetchFn } = await renderExperience({}, '/investments?tab=holdings');
    await press(request);
    expect(outcomeOf('holdings')).toMatchObject(outcome);
    const writes = (await sent(fetchFn)).filter(({ route }) => route.startsWith(method));
    expect(writes).toEqual([{ route: `${method} /api/v1/households/doe${path}`, body }]);
  });

  it('takes "See in Transactions" to the ledger filtered by the Holding (OQ-222)', async () => {
    await renderExperience({}, '/investments?tab=holdings');
    await press('seeTransactions');
    expect(screen.getByTestId('location').textContent).toBe('/transactions?holding=vale3');
  });
});

describe('the rates tab (FL20)', () => {
  it('hands the rates, the household\'s Holdings, its members and the viewer', async () => {
    const { fetchFn } = await renderExperience({}, '/investments?tab=rates');
    expect(shownBy('rates')).toEqual({
      rates: 'ready',
      holdings: HOLDINGS.length,
      recorders: ['Jane'],
      viewer: { selfUserId: 'jane', role: 'Member' },
    });
    // The overview isn't read until a tab needs it.
    expect(countOf(fetchFn, 'GET /households/doe/reports')).toBe(0);
  });

  it('leaves the Holdings and the members unknown while they load', async () => {
    await renderExperience({
      'GET /households/doe/holdings': () => new Promise(() => {}),
      'GET /households/doe/members': () => new Promise(() => {}),
    }, '/investments?tab=rates');
    expect(shownBy('rates')).toMatchObject({ holdings: null, recorders: null });
  });

  it.each([
    ['recordRate', 'POST', '/index-rates/cdi/values', { value: 105_000, asOf: '2026-10-01' }],
    ['editRate', 'PATCH', '/index-rates/cdi/values/v-1', { value: 104_000, asOf: '2026-09-30' }],
    ['deleteRate', 'DELETE', '/index-rates/cdi/values/v-1', undefined],
  ])('sends %s and refetches the rates and the Holdings (OQ-235)', async (
    request,
    method,
    path,
    body,
  ) => {
    const { fetchFn } = await renderExperience({}, '/investments?tab=rates');
    await press(request);
    expect(outcomeOf('rates')).toEqual({ ok: true });
    const writes = (await sent(fetchFn)).filter(({ route }) => route.startsWith(method));
    expect(writes).toEqual([{ route: `${method} /api/v1/households/doe${path}`, body }]);
    expect(countOf(fetchFn, 'GET /households/doe/index-rates')).toBe(2);
    expect(countOf(fetchFn, 'GET /households/doe/holdings')).toBe(2);
  });
});
