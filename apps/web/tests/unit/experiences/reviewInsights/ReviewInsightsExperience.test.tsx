import { act, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { DashboardFlowProps } from '../../../../src/experiences/reviewInsights/flows/dashboard/DashboardFlow';
import ReviewInsightsExperience from '../../../../src/experiences/reviewInsights/ReviewInsightsExperience';
import { householdChosen, switchHousehold } from '../../../../src/shell/shellState';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  fakeFetch, press, settle, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { ACCOUNTS } from '../monthFixtures';
import { HOLDINGS, PAYOUTS } from '../portfolioFixtures';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';
import { DASHBOARD } from './dashboardFixtures';

// The Review Insights Experience's Dashboard page (BDT: integration). The
// Dashboard Flow is a stub — its props worth asserting shown as JSON, one
// button per event; beneath it, the real store and API client — only `fetch`
// is fake.

vi.mock('../../../../src/experiences/reviewInsights/flows/dashboard/DashboardFlow', () => ({
  /**
   * The Dashboard Flow's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  DashboardFlow: ({
    dashboard, onRetry, onGoToTransactions, payouts,
  }: DashboardFlowProps) => (
    <Stub
      name="dashboard"
      shows={{
        status: dashboard.status,
        month: dashboard.status === 'loaded' ? dashboard.report.month : null,
        holdings: dashboard.status === 'loaded' ? dashboard.holdings.length : null,
        accounts: dashboard.status === 'loaded' ? dashboard.accounts.length : null,
        payouts: payouts.read.status,
        chosen: payouts.chosen.length,
      }}
      events={{ retry: onRetry, transactions: onGoToTransactions }}
    />
  ),
}));

const USER = {
  id: 'jane',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: '2024-01-01T00:00:00Z',
  preferences: { theme: 'dark', language: 'en-US' },
};

const DOE = {
  id: 'doe', name: 'The Doe Household', createdAt: '2025-03-01T00:00:00Z', role: 'Owner',
};
const RIVERA = { ...DOE, id: 'rivera', name: 'The Riveras' };

/** Answers for a page that loads: Jane, the Owner of Doe, and every read. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: [DOE, RIVERA] }),
  'GET /households/doe/dashboard': () => jsonResponse(200, DASHBOARD),
  'GET /households/doe/holdings': () => jsonResponse(200, { data: HOLDINGS }),
  'GET /households/doe/accounts': () => jsonResponse(200, { data: ACCOUNTS }),
  'GET /households/doe/reports/payouts': () => jsonResponse(200, PAYOUTS),
  'GET /households/rivera/dashboard': () => jsonResponse(200, { ...DASHBOARD, month: '2026-10' }),
  'GET /households/rivera/holdings': () => jsonResponse(200, { data: [] }),
  'GET /households/rivera/accounts': () => jsonResponse(200, { data: [] }),
  'GET /households/rivera/reports/payouts': () => jsonResponse(200, PAYOUTS),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 1, 0, 30));
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

/**
 * Renders the Experience over the real store, signed in with Doe active.
 *
 * @param answers - The API's answers, over the loaded page's.
 * @returns The fake `fetch` and the store.
 */
const renderExperience = async (answers: Answers = {}) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(<ReviewInsightsExperience />, store, { path: '/' });
  await settle();
  await settle();
  return { fetchFn, store };
};

/**
 * Counts the calls to one path since the test began.
 *
 * @param fetchFn - The fake `fetch`.
 * @param path - The path, after `/api/v1`.
 * @returns How many there were.
 */
const countOf = (fetchFn: ReturnType<typeof fakeFetch>, path: string) => (
  fetchFn.mock.calls.filter(([input]) => (
    new URL((input as Request).url).pathname === `/api/v1${path}`
  )).length
);

describe('the Dashboard page (X8)', () => {
  it('titles the page with the report\'s month, never the browser\'s (OQ-242)', async () => {
    await renderExperience();

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText(/gathered in one place/)).toBeTruthy();
    expect(screen.getByText('September/2026')).toBeTruthy();
  });

  it('hands the Flow the Dashboard, its Holdings and accounts, and the payout chart', async () => {
    await renderExperience();

    expect(shownBy('dashboard')).toEqual({
      status: 'loaded',
      month: '2026-09',
      holdings: HOLDINGS.length,
      accounts: ACCOUNTS.length,
      payouts: 'loaded',
      chosen: HOLDINGS.length,
    });
  });

  it('shows no month while the Dashboard loads', async () => {
    await renderExperience({ 'GET /households/doe/dashboard': () => new Promise(() => {}) });

    expect(screen.queryByText('September/2026')).toBeNull();
    expect(shownBy('dashboard')).toEqual(expect.objectContaining({ status: 'loading' }));
  });

  it('fails as one, and asks again only for what failed', async () => {
    let fails = true;
    const { fetchFn } = await renderExperience({
      'GET /households/doe/dashboard': () => (fails
        ? jsonResponse(500, envelope('internal.unexpected'))
        : jsonResponse(200, DASHBOARD)),
    });
    expect(shownBy('dashboard')).toEqual(expect.objectContaining({ status: 'failed' }));

    fails = false;
    await press('retry');
    await settle();

    expect(shownBy('dashboard')).toEqual(expect.objectContaining({ status: 'loaded' }));
    expect(countOf(fetchFn, '/households/doe/dashboard')).toBe(2);
    expect(countOf(fetchFn, '/households/doe/holdings')).toBe(1);
    expect(countOf(fetchFn, '/households/doe/accounts')).toBe(1);
  });

  it('goes to Transactions from the card a household with no Holding sees', async () => {
    await renderExperience();

    await press('transactions');

    expect(screen.getByTestId('location').textContent).toBe('/transactions');
  });

  it('starts afresh when the household changes', async () => {
    const { store } = await renderExperience();

    await act(async () => {
      store.dispatch(switchHousehold('rivera'));
    });
    await settle();
    await settle();

    expect(screen.getByText('October/2026')).toBeTruthy();
    expect(shownBy('dashboard')).toEqual(expect.objectContaining({ holdings: 0, accounts: 0 }));
  });

  it('shows placeholders while the user loads', async () => {
    await renderExperience({ 'GET /users/me': () => new Promise(() => {}) });

    expect(screen.getByRole('status', { name: 'Loading your dashboard' })).toBeTruthy();
  });

  it('offers a retry when the user can\'t be loaded', async () => {
    await renderExperience({
      'GET /users/me': () => jsonResponse(500, envelope('internal.unexpected')),
    });

    expect(screen.getByText('Couldn\'t load your dashboard.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
