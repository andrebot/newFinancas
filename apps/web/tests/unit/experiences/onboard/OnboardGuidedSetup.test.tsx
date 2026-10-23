import { screen } from '@testing-library/react';
import type { Account, Budget, Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import type {
  CategoryManagementFlowProps,
} from '../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow';
import { OnboardExperience } from '../../../../src/experiences/onboard/OnboardExperience';
import type {
  GuidedSetupFlowProps,
} from '../../../../src/experiences/onboard/flows/guidedSetup/GuidedSetupFlow';
import { householdChosen } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  fakeFetch, outcomeOf, press, sent, settle, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// Onboard's Guided Setup step (X2G, BDT: integration; OQ-198). The Flows it
// composes — Guided Setup and the Category Management Flow it hands into the
// categories step — are stubs with one button per request or event; beneath
// the Experience, the real store and API client: only `fetch` is fake.

vi.mock('../../../../src/experiences/onboard/flows/guidedSetup/GuidedSetupFlow', () => ({
  /**
   * Guided Setup's stand-in: what it was handed, and one button per request
   * and way out. It renders the Category Management Flow it was handed.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  GuidedSetupFlow: ({
    householdName, selfUserId, role, categories, budgets, onLoadAccounts, onCreateAccount,
    onCreateBudget, onEditBudget, onRetryCategories, onRetryBudgets, onFinish, categoryManagement,
  }: GuidedSetupFlowProps) => (
    <>
      <Stub
        name="guided"
        shows={{
          householdName, selfUserId, role, categories: categories.status, budgets: budgets.status,
        }}
        requests={{
          loadAccounts: () => onLoadAccounts(),
          createAccount: () => onCreateAccount({
            name: 'Main Checking',
            type: 'checking',
            currency: 'BRL',
            visibility: 'shared',
            openingBalance: 1000,
            cards: [],
          }),
          createBudget: () => onCreateBudget({
            name: 'Groceries',
            targetAmount: 80000,
            currency: 'BRL',
            visibility: 'shared',
            targets: [{ categoryId: 'cat' }],
          }),
          editBudget: () => onEditBudget({
            budgetId: 'groceries',
            name: 'Food',
            targetAmount: 90000,
            targets: [{ categoryId: 'cat' }],
          }),
        }}
        events={{
          retryCategories: onRetryCategories,
          retryBudgets: onRetryBudgets,
          toDashboard: () => onFinish('dashboard'),
          toTransactions: () => onFinish('transactions'),
          toHousehold: () => onFinish('household'),
          toGoals: () => onFinish('goals'),
        }}
      />
      {categoryManagement}
    </>
  ),
}));

vi.mock(
  '../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow',
  () => ({
    /**
     * The Category Management Flow's stand-in, as Onboard hands it in.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    CategoryManagementFlow: ({ role, categories, onCreate }: CategoryManagementFlowProps) => (
      <Stub
        name="categories"
        shows={{ role, categories: categories.status }}
        requests={{
          createCategory: () => onCreate({ name: 'Housing', icon: 'home-outline', color: 'mint' }),
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
  id: 'doe', name: 'The Doe Household', createdAt: '2026-10-15T12:00:00Z', role: 'Owner',
};

const ACCOUNT: Account = {
  id: 'chk',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Main Checking',
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-10-15',
  archivedAt: null,
  createdAt: '2026-10-15T12:00:00Z',
  currentBalance: 1000,
  cards: [],
};

const CATEGORY: Category = {
  id: 'cat',
  householdId: 'doe',
  name: 'Groceries',
  icon: 'home-outline',
  color: 'mint',
  archivedAt: null,
  createdAt: '2026-10-15T12:00:00Z',
  subcategories: [],
};

const BUDGET: Budget = {
  id: 'groceries',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Groceries',
  targetAmount: 80000,
  currency: 'BRL',
  visibility: 'shared',
  targets: [{ categoryId: 'cat' }],
  createdAt: '2026-10-15T12:00:00Z',
};

/** Answers for a wizard that loads: Jane, Owner of Doe, its lists. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: [DOE] }),
  'GET /households/doe/categories': () => jsonResponse(200, { data: [CATEGORY] }),
  'GET /households/doe/budgets': () => jsonResponse(200, { data: [BUDGET] }),
};

/**
 * Renders Guided Setup over the real store, signed in with Doe active.
 *
 * @param answers - The API's answers, over the loaded wizard's.
 * @returns The fake `fetch`.
 */
const renderGuidedSetup = async (answers: Answers = {}) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <OnboardExperience entry="guidedSetup" />
    </AlertProvider>,
    store,
    { path: '/setup/guided' },
  );
  await settle();
  return { fetchFn };
};

/**
 * Lists the routes `fetch` was called with.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each call's `METHOD path`.
 */
const routes = async (fetchFn: ReturnType<typeof fakeFetch>) => (
  (await sent(fetchFn)).map(({ route }) => route)
);

/**
 * Counts the times a list was fetched.
 *
 * @param fetchFn - The fake `fetch`.
 * @param list - Which: `budgets` or `categories`.
 * @returns How many `GET …/<list>` went out.
 */
const fetchesOf = async (fetchFn: ReturnType<typeof fakeFetch>, list: string) => (
  (await routes(fetchFn)).filter((route) => route === `GET /api/v1/households/doe/${list}`)
    .length
);

/** The address the router is at. */
const location = () => screen.getByTestId('location').textContent;

describe('OnboardExperience — Guided Setup', () => {
  it('waits for the household and the user, then sets the household up', async () => {
    const fetchFn = fakeFetch(LOADED);
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    store.dispatch(householdChosen('doe'));
    renderWithShell(<OnboardExperience entry="guidedSetup" />, store, { path: '/setup/guided' });

    expect(screen.getByRole('status', { name: 'Loading your household' })).toBeTruthy();
    await settle();
    // The lists are asked for once the wizard shows: one more round trip.
    await settle();

    expect(shownBy('guided')).toEqual({
      householdName: 'The Doe Household',
      selfUserId: 'jane',
      role: 'Owner',
      categories: 'loaded',
      budgets: 'loaded',
    });
    expect(shownBy('categories')).toEqual({ role: 'Owner', categories: 'loaded' });
  });

  it('offers a retry when the user can’t be loaded', async () => {
    let fails = true;
    await renderGuidedSetup({
      'GET /users/me': () => (
        fails ? jsonResponse(500, envelope('internal.unexpected')) : jsonResponse(200, USER)
      ),
    });

    expect(screen.getByText("Couldn't load your household.")).toBeTruthy();
    fails = false;
    await press('Try again');

    expect(screen.getByTestId('guided')).toBeTruthy();
  });

  it('answers the accounts’ load', async () => {
    const { fetchFn } = await renderGuidedSetup({
      'GET /households/doe/accounts': () => jsonResponse(200, { data: [ACCOUNT] }),
    });

    await press('loadAccounts');

    expect(outcomeOf('guided')).toEqual({ ok: true, data: [ACCOUNT] });
    expect(await routes(fetchFn)).toContain('GET /api/v1/households/doe/accounts');
  });

  it('creates the account with its starting balance', async () => {
    const { fetchFn } = await renderGuidedSetup({
      'POST /households/doe/accounts': () => jsonResponse(201, ACCOUNT),
    });

    await press('createAccount');

    expect(outcomeOf('guided')).toEqual({ ok: true, data: ACCOUNT });
    const calls = await sent(fetchFn);
    expect(calls[calls.length - 1]).toEqual({
      route: 'POST /api/v1/households/doe/accounts',
      body: {
        name: 'Main Checking',
        type: 'checking',
        currency: 'BRL',
        visibility: 'shared',
        openingBalance: 1000,
        cards: [],
      },
    });
  });

  it('answers the categories step’s writes, the list fetched again first', async () => {
    const { fetchFn } = await renderGuidedSetup({
      'POST /households/doe/categories': () => jsonResponse(201, CATEGORY),
    });

    await press('createCategory');

    expect(outcomeOf('categories')).toEqual({ ok: true });
    expect(await fetchesOf(fetchFn, 'categories')).toBe(2);
  });

  it('creates and edits a budget, the budgets fetched again first', async () => {
    const { fetchFn } = await renderGuidedSetup({
      'POST /households/doe/budgets': () => jsonResponse(201, BUDGET),
      'PATCH /households/doe/budgets/groceries': () => (
        jsonResponse(200, { ...BUDGET, name: 'Food' })
      ),
    });

    await press('createBudget');
    expect(outcomeOf('guided')).toEqual({ ok: true });
    await press('editBudget');

    expect(outcomeOf('guided')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toEqual(expect.arrayContaining([
      'POST /api/v1/households/doe/budgets',
      'PATCH /api/v1/households/doe/budgets/groceries',
    ]));
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(3);
  });

  it('fetches the lists again on their retries', async () => {
    const { fetchFn } = await renderGuidedSetup();

    await press('retryCategories');
    await press('retryBudgets');

    expect(await fetchesOf(fetchFn, 'categories')).toBe(3);
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(2);
  });

  it.each([
    ['toDashboard', '/'],
    ['toTransactions', '/transactions'],
    ['toHousehold', '/household'],
    ['toGoals', '/account-setup?tab=goals'],
  ])('leaves through %s for %s (mockup 14)', async (way, path) => {
    await renderGuidedSetup();

    await press(way);

    expect(location()).toBe(path);
  });
});
