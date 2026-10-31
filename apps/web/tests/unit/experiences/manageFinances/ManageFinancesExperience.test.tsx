import { act, fireEvent, screen } from '@testing-library/react';
import type { LedgerItem, TransactionPage } from '@financas/api-types';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { BrowseTransactionsFlowProps } from '../../../../src/experiences/manageFinances/flows/browseTransactions/BrowseTransactionsFlow';
import type { MonthOverviewFlowProps } from '../../../../src/experiences/manageFinances/flows/monthOverview/MonthOverviewFlow';
import type { RecordTransactionFlowProps } from '../../../../src/experiences/manageFinances/flows/recordTransaction/RecordTransactionFlow';
import ManageFinancesExperience from '../../../../src/experiences/manageFinances/ManageFinancesExperience';
import { householdChosen, switchHousehold } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  deferred, fakeFetch, outcomeOf, press, sent, settle, settleWith, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { ACCOUNTS, goalOf, REPORT } from '../monthFixtures';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// The Manage Finances Experience (BDT: integration). Its three Flows are
// stubs — one button per request or event the Experience answers, and the
// props worth asserting shown as JSON; beneath them, the real store and API
// client — only `fetch` is fake. Today is 15 September 2026.

const PLAIN: LedgerItem = {
  ledger: 'account', id: 't-1', kind: 'expense', amount: 1000, date: '2026-09-12',
};

const BUY: LedgerItem = {
  ledger: 'account', id: 't-2', kind: 'investment_buy', holdingId: 'h-1', date: '2026-09-10',
};

vi.mock(
  '../../../../src/experiences/manageFinances/flows/monthOverview/MonthOverviewFlow',
  () => ({
    /**
     * Month Overview's stand-in.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    MonthOverviewFlow: ({
      period, onPeriodChange, overview, onRetry, accounts, householdCreatedAt, currencyMemory,
    }: MonthOverviewFlowProps) => (
      <div data-region="overview-bar">
        <Stub
          name="month"
          shows={{
            period,
            overview: overview.status,
            accounts: accounts.length,
            householdCreatedAt,
            currency: currencyMemory.read(),
          }}
          events={{
            nextMonth: () => onPeriodChange({ year: 2026, month: 10 }),
            retryMonth: onRetry,
          }}
        />
      </div>
    ),
  }),
);

vi.mock(
  '../../../../src/experiences/manageFinances/flows/browseTransactions/BrowseTransactionsFlow',
  () => ({
    /**
     * Browse Transactions' stand-in.
     *
     * @param props - What the Experience passes.
     * @returns The stub, with the Experience's phone Filter button.
     */
    BrowseTransactionsFlow: ({
      filters, onFiltersChange, ledger, onReachedEnd, holdingName, filterOpen, onFilterClose,
      onDelete, onEdit, selfUserId, role, accounts, categories, stickyTop, filterAction,
    }: BrowseTransactionsFlowProps) => (
      <>
        <Stub
          name="browse"
          shows={{
            filters,
            pages: ledger.pages.length,
            hasMore: ledger.hasMore,
            status: ledger.status,
            holdingName,
            filterOpen,
            selfUserId,
            role,
            accounts: accounts.length,
            categories: categories.length,
            stickyTop,
          }}
          requests={{
            deleteRow: () => onDelete(PLAIN),
          }}
          events={{
            reachEnd: onReachedEnd,
            filterKinds: () => onFiltersChange({ ...filters, kinds: ['expense'] }),
            dropHolding: () => onFiltersChange({ ...filters, holdingId: undefined }),
            pickHolding: () => onFiltersChange({ ...filters, holdingId: 'h-9' }),
            closeFilter: onFilterClose,
            editPlain: () => onEdit(PLAIN),
            editBuy: () => onEdit(BUY),
          }}
        />
        <div data-testid="phone-filter">{filterAction}</div>
      </>
    ),
  }),
);

vi.mock(
  '../../../../src/experiences/manageFinances/flows/recordTransaction/RecordTransactionFlow',
  () => ({
    /**
     * Record Transaction's stand-in.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    RecordTransactionFlow: ({
      transaction, accounts, categories, goals, onLoadHoldings, onLoadSplit, onLoadSchedule,
      onRecord, onSave, onClose,
    }: RecordTransactionFlowProps) => (
      <Stub
        name="record"
        shows={{
          transaction, goals, accounts: accounts.length, categories: categories.length,
        }}
        requests={{
          loadHoldings: () => onLoadHoldings('inv'),
          loadSplit: () => onLoadSplit('h-1'),
          loadSchedule: () => onLoadSchedule('h-1'),
          recordOne: () => onRecord({
            kind: 'expense', accountId: 'itau', amount: 1000, date: '2026-09-15',
          } as never),
          saveOne: () => onSave('t-1', { description: 'Lunch' }),
        }}
        events={{ close: onClose }}
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
  id: 'doe', name: 'The Doe Household', createdAt: '2025-03-01T00:00:00Z', role: 'Owner',
};

/** The month's report, as `fetch` is asked for it. */
const MONTH = 'GET /households/doe/reports/month-overview';

/** A ledger page holding one row, with more after it unless `cursor` is null. */
const pageOf = (id: string, cursor: string | null): TransactionPage => ({
  items: [{ ...PLAIN, id }], dayTotals: [], monthCounts: [], nextCursor: cursor,
});

/** Answers for a page that loads: Jane, Owner of Doe, its lists, a ledger and the month. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: [DOE] }),
  'GET /households/doe/accounts': () => jsonResponse(200, { data: ACCOUNTS }),
  'GET /households/doe/categories': () => jsonResponse(200, { data: [] }),
  'GET /households/doe/transactions': (request) => jsonResponse(
    200, (
      new URL(request.url).searchParams.has('cursor') ? pageOf('t-9', null) : pageOf('t-1', 'c-1')
    ),
  ),
  'GET /households/doe/reports/month-overview': () => jsonResponse(200, REPORT),
  'GET /households/doe/goal-progress': (request) => jsonResponse(200, {
    data: [goalOf(new URL(request.url).searchParams.get('status') ?? '')],
  }),
};

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
 * @returns The fake `fetch`.
 */
const renderExperience = async (answers: Answers = {}, path = '/transactions') => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <ManageFinancesExperience />
    </AlertProvider>,
    store,
    { path },
  );
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
 * Clicks a button by its accessible name and lets what it started settle.
 *
 * @param name - The button's name.
 */
const click = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name })[0] as HTMLElement);
  });
  await settle();
};

describe('the page', () => {
  it('lays out the month and the ledger once its lists are in', async () => {
    window.localStorage.setItem('financas.monthOverview.currency', 'USD');
    await renderExperience();
    expect(screen.getByRole('heading', { level: 1, name: 'Transactions' })).toBeTruthy();
    expect(shownBy('month')).toEqual({
      period: { year: 2026, month: 9 },
      overview: 'loaded',
      accounts: ACCOUNTS.length,
      householdCreatedAt: DOE.createdAt,
      currency: 'USD',
    });
    expect(shownBy('browse')).toEqual({
      filters: {
        kinds: [],
        accountIds: [],
        creditCardIds: [],
        categoryIds: [],
        range: {
          preset: 'anyTime', from: '', to: '',
        },
      },
      pages: 1,
      hasMore: true,
      status: 'idle',
      filterOpen: false,
      selfUserId: 'jane',
      role: 'Owner',
      accounts: ACCOUNTS.length,
      categories: 0,
      stickyTop: 'calc(var(--spacing-shell-header) + var(--overview-bar-offset, 0px))',
    });
    expect(screen.queryByTestId('record')).toBeNull();
  });

  it('dates the month view from this household\'s creation (review V9)', async () => {
    const older = { ...DOE, id: 'older', createdAt: '2020-01-01T00:00:00Z' };
    await renderExperience({ 'GET /households': () => jsonResponse(200, { data: [older, DOE] }) });
    expect(shownBy('month'))
      .toEqual(expect.objectContaining({ householdCreatedAt: DOE.createdAt }));
  });

  it('reads no Holding without a Holding filter (review V9)', async () => {
    const { fetchFn } = await renderExperience();
    expect(calls(fetchFn).filter((route) => route.includes('/holdings/'))).toEqual([]);
  });

  it('shows a skeleton while the user loads', async () => {
    const hold = deferred();
    await renderExperience({ 'GET /users/me': () => hold.promise });
    expect(screen.getByRole('status', { name: 'Loading your transactions' })).toBeTruthy();
  });

  it('offers a retry when the user can’t load', async () => {
    const { fetchFn } = await renderExperience({
      'GET /users/me': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    expect(screen.getByText("Couldn't load your transactions.")).toBeTruthy();
    await click('Try again');
    expect(countOf(fetchFn, 'GET /users/me')).toBe(2);
  });

  it('shows a skeleton while the lists load', async () => {
    const hold = deferred();
    await renderExperience({ 'GET /households/doe/categories': () => hold.promise });
    expect(screen.getByRole('status', { name: 'Loading your transactions' })).toBeTruthy();
    await settleWith(hold, jsonResponse(200, { data: [] }));
    expect(screen.getByTestId('browse')).toBeTruthy();
  });

  it('offers a retry of both lists when one fails', async () => {
    let failing = true;
    const { fetchFn } = await renderExperience({
      'GET /households/doe/accounts': () => (failing
        ? jsonResponse(500, envelope('internal.unexpected'))
        : jsonResponse(200, { data: ACCOUNTS })),
    });
    expect(screen.getByText("Couldn't load your transactions.")).toBeTruthy();
    failing = false;
    await click('Try again');
    expect(countOf(fetchFn, 'GET /households/doe/accounts')).toBe(2);
    expect(countOf(fetchFn, 'GET /households/doe/categories')).toBe(2);
    expect(screen.getByTestId('browse')).toBeTruthy();
  });
});

describe('the month', () => {
  it('asks for today’s month, and another when the Flow does', async () => {
    const hold = deferred();
    const { fetchFn } = await renderExperience();
    expect(calls(fetchFn)).toContain(`${MONTH}?year=2026&month=9`);
    fetchFn.mockImplementationOnce(() => hold.promise);
    await press('nextMonth');
    expect(shownBy('month')).toEqual(expect.objectContaining({
      period: { year: 2026, month: 10 }, overview: 'loading',
    }));
    await settleWith(hold, jsonResponse(200, REPORT));
    expect(shownBy('month')).toEqual(expect.objectContaining({ overview: 'loaded' }));
    expect(calls(fetchFn)).toContain(`${MONTH}?year=2026&month=10`);
  });

  it('reads a failed month as failed and asks again on retry', async () => {
    let failing = true;
    await renderExperience({
      'GET /households/doe/reports/month-overview': () => (failing
        ? jsonResponse(500, envelope('internal.unexpected'))
        : jsonResponse(200, REPORT)),
    });
    expect(shownBy('month')).toEqual(expect.objectContaining({ overview: 'failed' }));
    failing = false;
    await press('retryMonth');
    expect(shownBy('month')).toEqual(expect.objectContaining({ overview: 'loaded' }));
  });
});

describe('the ledger', () => {
  it('asks for the next page by its cursor', async () => {
    const { fetchFn } = await renderExperience();
    await press('reachEnd');
    expect(calls(fetchFn)).toContain('GET /households/doe/transactions?cursor=c-1');
    expect(shownBy('browse')).toEqual(expect.objectContaining({ pages: 2, hasMore: false }));
  });

  it('asks again from the start when the filters change', async () => {
    const { fetchFn } = await renderExperience();
    await press('filterKinds');
    expect(calls(fetchFn)).toContain('GET /households/doe/transactions?kinds=expense');
    expect(shownBy('browse')).toEqual(expect.objectContaining({
      filters: expect.objectContaining({ kinds: ['expense'] }), pages: 1,
    }));
  });

  it('shows a failed next page and asks for it again', async () => {
    const { fetchFn } = await renderExperience();
    fetchFn.mockImplementationOnce(async () => jsonResponse(500, envelope('internal.unexpected')));
    await press('reachEnd');
    expect(shownBy('browse')).toEqual(expect.objectContaining({ status: 'error', pages: 1 }));
    await press('reachEnd');
    expect(shownBy('browse')).toEqual(expect.objectContaining({ status: 'idle', pages: 2 }));
  });

  it('asks for the first page again when it failed', async () => {
    let failing = true;
    const { fetchFn } = await renderExperience({
      'GET /households/doe/transactions': () => (failing
        ? jsonResponse(500, envelope('internal.unexpected'))
        : jsonResponse(200, pageOf('t-1', null))),
    });
    expect(shownBy('browse')).toEqual(expect.objectContaining({ status: 'error', pages: 0 }));
    failing = false;
    await press('reachEnd');
    expect(countOf(fetchFn, 'GET /households/doe/transactions')).toBe(2);
    expect(shownBy('browse')).toEqual(expect.objectContaining({ status: 'idle', pages: 1 }));
  });

  it('shows the first page loading', async () => {
    const hold = deferred();
    await renderExperience({ 'GET /households/doe/transactions': () => hold.promise });
    expect(shownBy('browse')).toEqual(expect.objectContaining({ status: 'loading', pages: 0 }));
  });
});

describe('the Holding filter', () => {
  it('comes from the address and is named by its ticker', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/holdings/h-1': () => jsonResponse(200, { id: 'h-1', ticker: 'BBAS3' }),
    }, '/transactions?holding=h-1&tab=x');
    expect(calls(fetchFn)).toContain('GET /households/doe/transactions?holdingId=h-1');
    expect(shownBy('browse')).toEqual(expect.objectContaining({
      filters: expect.objectContaining({ holdingId: 'h-1' }), holdingName: 'BBAS3',
    }));
  });

  it('leaves the address when removed, and nothing else with it', async () => {
    await renderExperience({
      'GET /households/doe/holdings/h-1': () => jsonResponse(200, { id: 'h-1', ticker: 'BBAS3' }),
    }, '/transactions?holding=h-1&tab=x');
    await press('dropHolding');
    expect(screen.getByTestId('location').textContent).toBe('/transactions?tab=x');
    expect(screen.getByTestId('location').dataset.navigation).toBe('REPLACE');
    expect(shownBy('browse')).not.toHaveProperty('holdingName');
  });

  it('enters the address when set, and stays put when it doesn’t move', async () => {
    await renderExperience({
      'GET /households/doe/holdings/h-9': () => jsonResponse(200, { id: 'h-9', ticker: 'AAPL' }),
    });
    await press('dropHolding');
    expect(screen.getByTestId('location').dataset.navigation).toBe('POP');
    await press('pickHolding');
    expect(screen.getByTestId('location').textContent).toBe('/transactions?holding=h-9');
  });
});

describe('the filter drawer', () => {
  it('draws the phone\'s Filter as an icon, the header\'s with its label (review V9)', async () => {
    await renderExperience();
    const phone = screen.getByTestId('phone-filter').querySelector('button')!;
    expect(phone.querySelector('.sr-only')?.textContent).toBe('Filter');
    const header = screen.getAllByRole('button', { name: /^Filter/ })
      .find((button) => !screen.getByTestId('phone-filter').contains(button))!;
    expect(header.querySelector('.sr-only')).toBeNull();
  });

  it('opens from the header and the phone’s button, counting the filters in use', async () => {
    await renderExperience();
    await press('filterKinds');
    expect(screen.getAllByText('1 filter in use')).toHaveLength(2);
    await click(/^Filter/);
    expect(shownBy('browse')).toEqual(expect.objectContaining({ filterOpen: true }));
    await press('closeFilter');
    expect(shownBy('browse')).toEqual(expect.objectContaining({ filterOpen: false }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('phone-filter').querySelector('button') as HTMLElement);
    });
    expect(shownBy('browse')).toEqual(expect.objectContaining({ filterOpen: true }));
  });
});

describe('the Holding filter across households', () => {
  it('is dropped when the household switches, never sent for the new one', async () => {
    const { fetchFn, store } = await renderExperience({
      'GET /households': () => jsonResponse(200, {
        data: [DOE, { ...DOE, id: 'rivera', name: 'Rivera' }],
      }),
      'GET /households/doe/holdings/h-1': () => jsonResponse(200, { id: 'h-1', ticker: 'BBAS3' }),
      'GET /households/rivera/accounts': () => jsonResponse(200, { data: ACCOUNTS }),
      'GET /households/rivera/categories': () => jsonResponse(200, { data: [] }),
      'GET /households/rivera/transactions': () => jsonResponse(200, pageOf('r-1', null)),
      'GET /households/rivera/reports/month-overview': () => jsonResponse(200, REPORT),
    }, '/transactions?holding=h-1');
    await act(async () => {
      store.dispatch(switchHousehold('rivera'));
    });
    await settle();
    await settle();
    expect(screen.getByTestId('location').textContent).toBe('/transactions');
    expect(calls(fetchFn).filter((call) => call.startsWith('GET /households/rivera/transactions')))
      .toEqual(['GET /households/rivera/transactions']);
    expect(shownBy('browse')).toEqual(expect.objectContaining({
      filters: expect.not.objectContaining({ holdingId: 'h-1' }),
    }));
  });
});

describe('a delete', () => {
  it('refreshes the ledger, the month and the Goals once it went through', async () => {
    const { fetchFn } = await renderExperience({
      'DELETE /households/doe/transactions/t-1': () => new Response(null, { status: 204 }),
    });
    await press('deleteRow');
    expect(outcomeOf('browse')).toEqual({ ok: true });
    expect(countOf(fetchFn, 'GET /households/doe/transactions')).toBe(2);
    expect(countOf(fetchFn, 'GET /households/doe/reports/month-overview')).toBe(2);
  });

  it('refreshes too when the row was already gone', async () => {
    const { fetchFn } = await renderExperience({
      'DELETE /households/doe/transactions/t-1': () => jsonResponse(
        404,
        envelope('transaction.not_found'),
      ),
    });
    await press('deleteRow');
    expect(outcomeOf('browse')).toEqual({
      ok: false, error: { code: 'transaction.not_found', params: {} },
    });
    expect(countOf(fetchFn, 'GET /households/doe/transactions')).toBe(2);
  });

  it('shows a failed refresh with its rows, and fetches it again on Try again', async () => {
    let failing = false;
    const { fetchFn } = await renderExperience({
      'DELETE /households/doe/transactions/t-1': () => new Response(null, { status: 204 }),
      'GET /households/doe/transactions': () => (failing
        ? jsonResponse(500, envelope('internal.unexpected'))
        : jsonResponse(200, pageOf('t-1', null))),
    });
    failing = true;
    await press('deleteRow');
    expect(shownBy('browse')).toEqual(expect.objectContaining({ status: 'error', pages: 1 }));
    failing = false;
    await press('reachEnd');
    expect(countOf(fetchFn, 'GET /households/doe/transactions')).toBe(3);
    expect(shownBy('browse')).toEqual(expect.objectContaining({ status: 'idle', pages: 1 }));
  });

  it('refreshes nothing after another refusal', async () => {
    const { fetchFn } = await renderExperience({
      'DELETE /households/doe/transactions/t-1': () => jsonResponse(
        409,
        envelope('account.archived'),
      ),
    });
    await press('deleteRow');
    expect(countOf(fetchFn, 'GET /households/doe/transactions')).toBe(1);
  });
});

describe('the record drawer', () => {
  it('opens on a new transaction with the Goals, active first', async () => {
    const { fetchFn } = await renderExperience();
    expect(countOf(fetchFn, 'GET /households/doe/goal-progress')).toBe(0);
    await click('Record Transaction');
    await settle();
    expect(shownBy('record')).toEqual({
      goals: [
        {
          id: 'active', name: 'active', progress: 0, completed: false,
        },
        {
          id: 'completed', name: 'completed', progress: 0, completed: true,
        },
      ],
      accounts: ACCOUNTS.length,
      categories: 0,
    });
    expect(calls(fetchFn)).toContain('GET /households/doe/goal-progress?status=completed');
    await press('close');
    expect(screen.queryByTestId('record')).toBeNull();
  });

  it('waits for the Goals before it opens, and opens without them when they fail', async () => {
    const hold = deferred();
    await renderExperience({ 'GET /households/doe/goal-progress': () => hold.promise });
    await click('Record Transaction');
    expect(screen.queryByTestId('record')).toBeNull();
    await settleWith(hold, jsonResponse(500, envelope('internal.unexpected')));
    await settle();
    expect(shownBy('record')).toEqual(expect.objectContaining({ goals: [] }));
  });

  it('waits for both Goal reads, the completed ones too (review V9)', async () => {
    const hold = deferred();
    await renderExperience({
      'GET /households/doe/goal-progress': (request) => (
        new URL(request.url).searchParams.get('status') === 'completed'
          ? hold.promise
          : jsonResponse(200, { data: [] })
      ),
    });
    await click('Record Transaction');
    await settle();
    expect(screen.queryByTestId('record')).toBeNull();
    await settleWith(hold, jsonResponse(200, { data: [] }));
    await settle();
    expect(screen.getByTestId('record')).toBeDefined();
  });

  it('names the phone\'s floating Record button like the header\'s (review V8)', async () => {
    await renderExperience();
    expect(screen.getAllByRole('button', { name: 'Record Transaction' })).toHaveLength(2);
  });

  it('records, refreshing the page, and saves an edit', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/transactions': () => jsonResponse(201, PLAIN),
      'PATCH /households/doe/transactions/t-1': () => jsonResponse(
        409,
        envelope('transaction.changed'),
      ),
    });
    // The phone's floating button.
    await act(async () => {
      fireEvent.click(screen.getByText('Record'));
    });
    await settle();
    await settle();
    await press('recordOne');
    expect(outcomeOf('record')).toEqual({ ok: true });
    expect(countOf(fetchFn, 'GET /households/doe/transactions')).toBe(2);
    expect(countOf(fetchFn, 'GET /households/doe/goal-progress')).toBe(4);
    await press('saveOne');
    expect(outcomeOf('record')).toEqual({
      ok: false, error: { code: 'transaction.changed', params: {} },
    });
    const bodies = await sent(fetchFn);
    expect(bodies.at(-1)?.body).toEqual({ description: 'Lunch' });
    const recorded = bodies.find(({ route }) => route.startsWith('POST'));
    expect(recorded?.body).toEqual(expect.objectContaining({
      kind: 'expense', accountId: 'itau',
    }));
  });

  it('answers the Flow’s reads', async () => {
    await renderExperience({
      'GET /households/doe/accounts/inv/holdings': () => jsonResponse(200, {
        data: [{ id: 'h-1' }],
      }),
      'GET /households/doe/holdings/h-1/allocations': () => jsonResponse(200, {
        data: [{ goalId: 'active', percentage: 100 }],
      }),
      'GET /households/doe/holdings/h-1/schedule-entries': () => jsonResponse(
        404,
        envelope('holding.not_found'),
      ),
    });
    await click('Record Transaction');
    await settle();
    await press('loadHoldings');
    expect(outcomeOf('record')).toEqual({ ok: true, data: [{ id: 'h-1' }] });
    await press('loadSplit');
    expect(outcomeOf('record')).toEqual({
      ok: true, data: [{ goalId: 'active', percentage: 100 }],
    });
    await press('loadSchedule');
    expect(outcomeOf('record')).toEqual({
      ok: false, error: { code: 'holding.not_found', params: {} },
    });
  });
});

describe('an edit', () => {
  it('opens a row straight away', async () => {
    await renderExperience();
    await press('editPlain');
    await settle();
    expect(shownBy('record')).toEqual(expect.objectContaining({ transaction: { item: PLAIN } }));
  });

  it('opens a buy once its Holding is read', async () => {
    const holding = { id: 'h-1', ticker: 'CDB' };
    await renderExperience({
      'GET /households/doe/holdings/h-1': () => jsonResponse(200, holding),
    });
    await press('editBuy');
    await settle();
    expect(shownBy('record')).toEqual(expect.objectContaining({
      transaction: { item: BUY, holding },
    }));
  });

  it('drops a Holding read that returns after another row was opened', async () => {
    const hold = deferred();
    await renderExperience({ 'GET /households/doe/holdings/h-1': () => hold.promise });
    await press('editBuy');
    await press('editPlain');
    await settle();
    expect(shownBy('record')).toEqual(expect.objectContaining({ transaction: { item: PLAIN } }));
    await settleWith(hold, jsonResponse(200, { id: 'h-1', ticker: 'CDB' }));
    expect(shownBy('record')).toEqual(expect.objectContaining({ transaction: { item: PLAIN } }));
  });

  it('drops a failed Holding read once the user moved on, without a toast', async () => {
    const hold = deferred();
    await renderExperience({ 'GET /households/doe/holdings/h-1': () => hold.promise });
    await press('editBuy');
    await click('Record Transaction');
    await settle();
    await press('close');
    await settleWith(hold, jsonResponse(500, envelope('internal.unexpected')));
    expect(screen.queryByText("Couldn't open this transaction. Try again.")).toBeNull();
    expect(screen.queryByTestId('record')).toBeNull();
  });

  it('opens nothing for a Holding read landing after a close (review V5)', async () => {
    const hold = deferred();
    await renderExperience({ 'GET /households/doe/holdings/h-1': () => hold.promise });
    await click('Record Transaction');
    await settle();
    await press('editBuy');
    await press('close');
    await settleWith(hold, jsonResponse(200, { id: 'h-1', ticker: 'CDB' }));
    expect(screen.queryByTestId('record')).toBeNull();
  });

  it('toasts and opens nothing when the Holding can’t be read', async () => {
    await renderExperience({
      'GET /households/doe/holdings/h-1': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    await press('editBuy');
    await settle();
    expect(screen.getByText("Couldn't open this transaction. Try again.")).toBeTruthy();
    expect(screen.queryByTestId('record')).toBeNull();
  });
});
