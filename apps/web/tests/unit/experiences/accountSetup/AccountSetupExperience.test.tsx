import { act, fireEvent, screen } from '@testing-library/react';
import type {
  Account, Budget, Category, Goal, GoalWithProgress,
} from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { AccountManagementFlowProps } from '../../../../src/experiences/accountSetup/flows/accountManagement/AccountManagementFlow';
import type { BudgetManagementFlowProps } from '../../../../src/experiences/accountSetup/flows/budgetManagement/BudgetManagementFlow';
import type { CategoryManagementFlowProps } from '../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow';
import type { GoalManagementFlowProps } from '../../../../src/experiences/accountSetup/flows/goalManagement/GoalManagementFlow';
import {
  AccountSetupExperience, goalListViewOf, listsToRefresh, listViewOf, progressStatusOf, tabOf,
} from '../../../../src/experiences/accountSetup/AccountSetupExperience';
import { householdChosen } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  deferred, fakeFetch, outcomeOf, press, sent, settle, settleWith, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// The Account Setup Experience (BDT: integration). Its Flow is a stub with one
// button per request the Experience answers; beneath it, the real store and
// API client — only `fetch` is fake.

vi.mock(
  '../../../../src/experiences/accountSetup/flows/accountManagement/AccountManagementFlow',
  () => ({
    /**
     * The Account Management Flow's stand-in: one button per request branch.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    AccountManagementFlow: ({
      selfUserId, role, onLoad, onCreate, onEdit, onArchive,
    }: AccountManagementFlowProps) => (
      <Stub
        name="accounts"
        shows={{ selfUserId, role }}
        requests={{
          load: () => onLoad(),
          createZero: () => onCreate({
            name: 'Main Checking',
            type: 'checking',
            currency: 'BRL',
            visibility: 'personal',
            openingBalance: null,
            cards: [],
          }),
          createFunded: () => onCreate({
            name: 'Savings',
            type: 'savings',
            currency: 'BRL',
            visibility: 'shared',
            openingBalance: 150,
            cards: [],
          }),
          editPlain: () => onEdit({ accountId: 'chk', name: 'Renamed' }),
          editFull: () => onEdit({
            accountId: 'ccr', name: 'Cards', visibility: 'personal', cards: { remove: ['card-1'] },
          }),
          archive: () => onArchive('ccr'),
        }}
      />
    ),
  }),
);

vi.mock(
  '../../../../src/experiences/accountSetup/flows/categoryManagement/CategoryManagementFlow',
  () => ({
    /**
     * The Category Management Flow's stand-in: one button per request branch.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    CategoryManagementFlow: ({
      role, categories, onRetry, onCreate, onEdit, onAddSubcategory, onArchiveCategory,
      onArchiveSubcategory,
    }: CategoryManagementFlowProps) => (
      <Stub
        name="categories"
        shows={{ role, categories }}
        events={{ retry: onRetry }}
        requests={{
          create: () => onCreate({ name: 'Housing', icon: 'home-outline', color: 'mint' }),
          editPlain: () => onEdit({
            categoryId: 'cat', name: 'Renamed', icon: 'home-outline', color: 'mint',
          }),
          addSub: () => onAddSubcategory('cat', 'Parking'),
          archiveCategory: () => onArchiveCategory('cat'),
          archiveSub: () => onArchiveSubcategory('cat', 's1'),
        }}
      />
    ),
  }),
);

vi.mock(
  '../../../../src/experiences/accountSetup/flows/budgetManagement/BudgetManagementFlow',
  () => ({
    /**
     * The Budget Management Flow's stand-in: one button per request branch.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    BudgetManagementFlow: ({
      selfUserId, role, budgets, categories, onRetry, onCreate, onEdit, onDelete,
    }: BudgetManagementFlowProps) => (
      <Stub
        name="budgets"
        shows={{
          selfUserId, role, budgets, categories,
        }}
        events={{ retry: onRetry }}
        requests={{
          createBudget: () => onCreate({
            name: 'Fun Money',
            targetAmount: 30000,
            currency: 'USD',
            visibility: 'personal',
            targets: [{ categoryId: 'cat' }],
          }),
          editBudget: () => onEdit({
            budgetId: 'fun', name: 'Fun', targetAmount: 20000, targets: [{ subcategoryId: 's1' }],
          }),
          deleteBudget: () => onDelete('fun'),
        }}
      />
    ),
  }),
);

vi.mock(
  '../../../../src/experiences/accountSetup/flows/goalManagement/GoalManagementFlow',
  () => ({
    /**
     * The Goal Management Flow's stand-in: one button per request branch.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    GoalManagementFlow: ({
      selfUserId, role, goals, onRetry, onCreate, onEdit, onDelete, onComplete, onReopen,
    }: GoalManagementFlowProps) => (
      <Stub
        name="goals"
        shows={{ selfUserId, role, goals }}
        events={{ retry: onRetry }}
        requests={{
          createGoal: () => onCreate({
            name: 'Trip',
            targetAmount: 600000,
            targetCurrency: 'USD',
            dueDate: '2028-04-01',
            visibility: 'shared',
          }),
          editGoal: () => onEdit({
            goalId: 'trip',
            name: 'Japan',
            targetAmount: 700000,
            targetCurrency: 'BRL',
            dueDate: '2028-05-01',
          }),
          deleteGoal: () => onDelete('trip'),
          completeGoal: () => onComplete('trip'),
          reopenGoal: () => onReopen('trip'),
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
  id: 'doe', name: 'The Doe Household', createdAt: '2024-01-01T00:00:00Z', role: 'Owner',
};

const ACCOUNT: Account = {
  id: 'chk',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Main Checking',
  type: 'checking',
  currency: 'BRL',
  visibility: 'personal',
  startingBalanceDate: '2026-10-01',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  currentBalance: 150,
  cards: [],
};

/** Answers for a page that loads: Jane, Owner of Doe. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: [DOE] }),
};

/**
 * Renders the Experience over the real store, signed in with Doe active.
 *
 * @param answers - The API's answers, over the loaded page's.
 * @param loads - Whether to wait for the page to show.
 * @param path - The address it opens on.
 * @returns The store and the fake `fetch`.
 */
const renderExperience = async (
  answers: Answers = {},
  loads = true,
  path = '/account-setup',
) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <AccountSetupExperience />
    </AlertProvider>,
    store,
    { path },
  );
  if (loads) await screen.findByRole('heading', { level: 1 });
  await settle();
  return { store, fetchFn };
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
 * Reads the last body a create or edit went out with.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns The call's parsed body, if any.
 */
const lastBody = async (fetchFn: ReturnType<typeof fakeFetch>) => {
  const calls = await sent(fetchFn);
  return calls[calls.length - 1]?.body;
};

/**
 * Selects the Categories tab so its stub is in front.
 */
const pickCategories = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Categories' }));
  });
};

describe('the page', () => {
  it('opens on Accounts with its flow, signed in as the household’s owner', async () => {
    await renderExperience();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Accounts');
    expect(screen.getByText(
      'Your checking, savings and credit card accounts — and the cards attached to them.',
    )).toBeTruthy();
    expect(shownBy('accounts')).toEqual({ selfUserId: 'jane', role: 'Owner' });
    expect(screen.getByRole('radio', { name: 'Accounts' })).toBeTruthy();
  });

  it('shows each section’s flow under its tab', async () => {
    await renderExperience({
      'GET /households/doe/categories': () => jsonResponse(200, { data: [] }),
      'GET /households/doe/budgets': () => jsonResponse(200, { data: [] }),
      'GET /households/doe/goals': () => jsonResponse(200, { data: [] }),
      'GET /households/doe/goal-progress': () => jsonResponse(200, { data: [] }),
    });
    const pickTab = async (tab: string) => {
      await act(async () => {
        fireEvent.click(screen.getByRole('radio', { name: tab }));
      });
    };
    await pickTab('Categories');
    expect(screen.getByTestId('categories')).toBeTruthy();
    await pickTab('Budgets');
    expect(screen.getByTestId('budgets')).toBeTruthy();
    await pickTab('Goals');
    expect(screen.getByTestId('goals')).toBeTruthy();
    await pickTab('Accounts');
    expect(screen.getByTestId('accounts')).toBeTruthy();
  });

  it('shows a skeleton while the user loads', async () => {
    const hold = deferred();
    const fetchFn = fakeFetch({ ...LOADED, 'GET /users/me': () => hold.promise });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    store.dispatch(householdChosen('doe'));
    renderWithShell(
      <AlertProvider queue={createAlertQueue(3)}>
        <AccountSetupExperience />
      </AlertProvider>,
      store,
      { path: '/account-setup' },
    );
    expect(screen.getByRole('status', { name: 'Loading the setup' })).toBeTruthy();
  });

  it('offers a retry when the user can’t load', async () => {
    const fetchFn = fakeFetch({
      ...LOADED,
      'GET /users/me': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
    store.dispatch(householdChosen('doe'));
    renderWithShell(
      <AlertProvider queue={createAlertQueue(3)}>
        <AccountSetupExperience />
      </AlertProvider>,
      store,
      { path: '/account-setup' },
    );
    await screen.findByText("Couldn't load the setup.");

    await press('Try again');
    expect(await routes(fetchFn)).toEqual([
      'GET /api/v1/users/me', 'GET /api/v1/households', 'GET /api/v1/users/me',
    ]);
  });
});

describe('the accounts it answers for its flow', () => {
  it('lists them through the endpoint, archived included', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/accounts': () => jsonResponse(200, { data: [ACCOUNT] }),
    });
    await press('load');
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: [ACCOUNT] });
    expect(await routes(fetchFn)).toContain('GET /api/v1/households/doe/accounts');
  });

  it('shows the failure when a load fails', async () => {
    await renderExperience({
      'GET /households/doe/accounts': () => jsonResponse(500, envelope('internal.unexpected')),
    });
    await press('load');
    expect(outcomeOf('accounts')).toEqual(
      { ok: false, error: { code: 'internal.unexpected', params: {} } },
    );
  });

  it('shows the failure when a create fails', async () => {
    await renderExperience({
      'POST /households/doe/accounts': () => jsonResponse(403, envelope('auth.forbidden')),
    });
    await press('createZero');
    expect(outcomeOf('accounts')).toEqual(
      { ok: false, error: { code: 'auth.forbidden', params: {} } },
    );
  });

  it.each([
    ['editPlain', 'PATCH /households/doe/accounts/chk', 409, 'account.archived'],
    ['archive', 'POST /households/doe/accounts/ccr/archive', 403, 'auth.forbidden'],
  ])('answers a failed %s with its error', async (button, route, status, code) => {
    await renderExperience({ [route]: () => jsonResponse(status, envelope(code)) });
    await press(button);
    expect(outcomeOf('accounts')).toEqual({ ok: false, error: { code, params: {} } });
  });

  it('creates without an opening balance when there is none', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/accounts': () => jsonResponse(201, ACCOUNT),
    });
    await press('createZero');
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: ACCOUNT });
    expect(await lastBody(fetchFn)).toEqual({
      name: 'Main Checking', type: 'checking', currency: 'BRL', visibility: 'personal', cards: [],
    });
  });

  it('creates with its opening balance when there is one', async () => {
    const funded = {
      ...ACCOUNT, id: 'sav', name: 'Savings', type: 'savings' as const,
    };
    const { fetchFn } = await renderExperience({
      'POST /households/doe/accounts': () => jsonResponse(201, funded),
    });
    await press('createFunded');
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: funded });
    expect(await lastBody(fetchFn)).toEqual({
      name: 'Savings',
      type: 'savings',
      currency: 'BRL',
      visibility: 'shared',
      openingBalance: 150,
      cards: [],
    });
  });

  it('edits with only what moved', async () => {
    const renamed = { ...ACCOUNT, name: 'Renamed' };
    const { fetchFn } = await renderExperience({
      'PATCH /households/doe/accounts/chk': () => jsonResponse(200, renamed),
    });
    await press('editPlain');
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: renamed });
    expect(await lastBody(fetchFn)).toEqual({ name: 'Renamed' });
  });

  it('edits with its moved visibility and card changes', async () => {
    const cards = { ...ACCOUNT, id: 'ccr', type: 'credit_card_only' as const };
    const { fetchFn } = await renderExperience({
      'PATCH /households/doe/accounts/ccr': () => jsonResponse(200, cards),
    });
    await press('editFull');
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: cards });
    expect(await lastBody(fetchFn)).toEqual({
      name: 'Cards', visibility: 'personal', cards: { remove: ['card-1'] },
    });
  });

  it('archives through its endpoint and shows the success', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/accounts/ccr/archive': () => jsonResponse(204),
    });
    await press('archive');
    expect(outcomeOf('accounts')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain('POST /api/v1/households/doe/accounts/ccr/archive');
  });
});

const SUB = {
  id: 's1',
  categoryId: 'cat',
  name: 'Rent',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
};

const CATEGORY: Category = {
  id: 'cat',
  householdId: 'doe',
  name: 'Housing',
  icon: 'home-outline',
  color: 'mint',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  subcategories: [SUB],
};

/** The list the categories endpoint answers. */
const CATEGORIES_LISTED = () => jsonResponse(200, { data: [CATEGORY] });

/**
 * Counts the times the categories list was fetched.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns How many `GET …/categories` went out.
 */
const listFetches = async (fetchFn: ReturnType<typeof fakeFetch>) => (
  (await routes(fetchFn)).filter((route) => route === 'GET /api/v1/households/doe/categories')
    .length
);

describe('the category list it holds for its flows', () => {
  it('fetches it once, archived included, and hands it down', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
    });
    await pickCategories();
    expect(shownBy('categories')).toEqual({
      role: 'Owner', categories: { status: 'loaded', categories: [CATEGORY] },
    });
    const urls = fetchFn.mock.calls.map(([input]) => (input as Request).url);
    expect(urls.some((url) => url.endsWith('/categories?includeArchived=true'))).toBe(true);
    expect(await listFetches(fetchFn)).toBe(1);
  });

  it('hands down loading until the list comes', async () => {
    const held = deferred();
    await renderExperience({ 'GET /households/doe/categories': () => held.promise });
    await pickCategories();
    expect(shownBy('categories')).toEqual(expect.objectContaining({
      categories: { status: 'loading' },
    }));
  });

  it('hands down the failure and fetches again on a retry', async () => {
    const answers = vi.fn()
      .mockReturnValueOnce(jsonResponse(500, envelope('internal.unexpected')))
      .mockImplementation(CATEGORIES_LISTED);
    const { fetchFn } = await renderExperience({ 'GET /households/doe/categories': answers });
    await pickCategories();
    expect(shownBy('categories')).toEqual(expect.objectContaining({
      categories: { status: 'failed', error: { code: 'internal.unexpected', params: {} } },
    }));
    await press('retry');
    expect(await listFetches(fetchFn)).toBe(2);
    expect(shownBy('categories')).toEqual(expect.objectContaining({
      categories: { status: 'loaded', categories: [CATEGORY] },
    }));
  });
});

describe('the category writes it answers for its flow', () => {
  it('creates with only the fields, and answers once the list is fetched again', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
      'POST /households/doe/categories': () => jsonResponse(201, CATEGORY),
    });
    await pickCategories();
    await press('create');
    expect(outcomeOf('categories')).toEqual({ ok: true });
    const calls = await sent(fetchFn);
    const post = calls.find(({ route }) => route === 'POST /api/v1/households/doe/categories');
    expect(post?.body).toEqual({ name: 'Housing', icon: 'home-outline', color: 'mint' });
    expect(await listFetches(fetchFn)).toBe(2);
  });

  it('answers a failed create with its error, and fetches nothing again', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
      'POST /households/doe/categories': () => jsonResponse(403, envelope('auth.forbidden')),
    });
    await pickCategories();
    await press('create');
    expect(outcomeOf('categories')).toEqual(
      { ok: false, error: { code: 'auth.forbidden', params: {} } },
    );
    expect(await listFetches(fetchFn)).toBe(1);
  });

  it('hands down the list with its failure when the fetch after a write fails', async () => {
    const lists = vi.fn()
      .mockReturnValueOnce(CATEGORIES_LISTED())
      .mockReturnValueOnce(jsonResponse(500, envelope('internal.unexpected')))
      .mockImplementation(CATEGORIES_LISTED);
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': lists,
      'POST /households/doe/categories': () => jsonResponse(201, CATEGORY),
    });
    await pickCategories();
    await press('create');
    expect(outcomeOf('categories')).toEqual({ ok: true });
    expect(shownBy('categories')).toEqual(expect.objectContaining({
      categories: {
        status: 'loaded',
        categories: [CATEGORY],
        refreshError: { code: 'internal.unexpected', params: {} },
      },
    }));
    await press('retry');
    expect(await listFetches(fetchFn)).toBe(3);
    expect(shownBy('categories')).toEqual(expect.objectContaining({
      categories: { status: 'loaded', categories: [CATEGORY] },
    }));
  });

  it.each([
    ['editPlain', 'PATCH /households/doe/categories/cat', 422, 'field.invalid_option'],
    ['addSub', 'PATCH /households/doe/categories/cat', 403, 'auth.forbidden'],
    ['archiveCategory', 'POST /households/doe/categories/cat/archive', 404, 'category.not_found'],
    [
      'archiveSub',
      'POST /households/doe/categories/cat/subcategories/s1/archive',
      404,
      'subcategory.not_found',
    ],
  ])('answers a failed %s with its error, and fetches nothing again', async (
    button,
    route,
    status,
    code,
  ) => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
      [route]: () => jsonResponse(status, envelope(code)),
    });
    await pickCategories();
    await press(button);
    expect(outcomeOf('categories')).toEqual({ ok: false, error: { code, params: {} } });
    expect(await listFetches(fetchFn)).toBe(1);
  });

  it('edits with its fields, address stripped out', async () => {
    const renamed = { ...CATEGORY, name: 'Renamed' };
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
      'PATCH /households/doe/categories/cat': () => jsonResponse(200, renamed),
    });
    await pickCategories();
    await press('editPlain');
    const calls = await sent(fetchFn);
    const patch = calls.find(({ route }) => route.startsWith('PATCH'));
    expect(patch?.body).toEqual({ name: 'Renamed', icon: 'home-outline', color: 'mint' });
    expect(await listFetches(fetchFn)).toBe(2);
  });

  it('adds a subcategory in the same atomic edit (OQ-173)', async () => {
    const grown = { ...CATEGORY, subcategories: [SUB, { ...SUB, id: 's2', name: 'Parking' }] };
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
      'PATCH /households/doe/categories/cat': () => jsonResponse(200, grown),
    });
    await pickCategories();
    await press('addSub');
    expect(outcomeOf('categories')).toEqual({ ok: true });
    const calls = await sent(fetchFn);
    const patch = calls.find(({ route }) => route.startsWith('PATCH'));
    expect(patch?.body).toEqual({ subcategories: [{ name: 'Parking' }] });
  });

  it('archives a category through its endpoint', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
      'POST /households/doe/categories/cat/archive': () => jsonResponse(204),
    });
    await pickCategories();
    await press('archiveCategory');
    expect(outcomeOf('categories')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain('POST /api/v1/households/doe/categories/cat/archive');
    expect(await listFetches(fetchFn)).toBe(2);
  });

  it('archives a subcategory through its endpoint', async () => {
    const { fetchFn } = await renderExperience({
      'GET /households/doe/categories': CATEGORIES_LISTED,
      'POST /households/doe/categories/cat/subcategories/s1/archive': () => jsonResponse(204),
    });
    await pickCategories();
    await press('archiveSub');
    expect(outcomeOf('categories')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain(
      'POST /api/v1/households/doe/categories/cat/subcategories/s1/archive',
    );
  });
});

describe('listViewOf', () => {
  it('reads a list under its field, its latest failure beside it, or its first failure', () => {
    const failure = {
      status: 500, code: 'internal.unexpected', params: {}, details: [], correlationId: 'c',
    };
    expect(listViewOf('budgets', {})).toEqual({ status: 'loading' });
    expect(listViewOf('budgets', { data: [] })).toEqual({ status: 'loaded', budgets: [] });
    expect(listViewOf('budgets', { data: [], error: failure })).toEqual({
      status: 'loaded', budgets: [], refreshError: { code: 'internal.unexpected', params: {} },
    });
    expect(listViewOf('budgets', { error: failure })).toEqual({
      status: 'failed', error: { code: 'internal.unexpected', params: {} },
    });
  });
});

describe('listsToRefresh', () => {
  it('fetches the budgets again after a success', () => {
    expect(listsToRefresh({ ok: true })).toEqual({ budgets: true, categories: false });
  });

  it.each([
    ['budget.target_already_claimed', { budgets: true, categories: false }],
    ['budget.not_found', { budgets: true, categories: false }],
    ['validation.failed', { budgets: true, categories: true }],
    ['auth.forbidden', { budgets: false, categories: false }],
  ])('after a %s, fetches what moved (OQ-194)', (code, lists) => {
    expect(listsToRefresh({ ok: false, error: { code } })).toEqual(lists);
  });
});

const BUDGET: Budget = {
  id: 'fun',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Fun Money',
  targetAmount: 30000,
  currency: 'USD',
  visibility: 'personal',
  targets: [{ categoryId: 'cat' }],
  createdAt: '2026-10-01T00:00:00Z',
};

/** The list the budgets endpoint answers. */
const BUDGETS_LISTED = () => jsonResponse(200, { data: [BUDGET] });

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

/** Selects the Budgets tab so its stub is in front. */
const pickBudgets = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Budgets' }));
  });
};

/** Answers for a page whose two lists load. */
const LISTS: Answers = {
  'GET /households/doe/categories': CATEGORIES_LISTED,
  'GET /households/doe/budgets': BUDGETS_LISTED,
};

describe('the budgets it holds for their flow', () => {
  it('hands down the budgets and the categories, with the actor', async () => {
    await renderExperience(LISTS);
    await pickBudgets();
    expect(shownBy('budgets')).toEqual({
      selfUserId: 'jane',
      role: 'Owner',
      budgets: { status: 'loaded', budgets: [BUDGET] },
      categories: { status: 'loaded', categories: [CATEGORY] },
    });
  });

  it('fetches both lists again on a retry', async () => {
    const { fetchFn } = await renderExperience(LISTS);
    await pickBudgets();
    await press('retry');
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(2);
    expect(await fetchesOf(fetchFn, 'categories')).toBe(2);
  });
});

describe('the budget writes it answers for their flow', () => {
  it('creates with only the fields, and answers once the budgets are fetched again', async () => {
    const { fetchFn } = await renderExperience({
      ...LISTS, 'POST /households/doe/budgets': () => jsonResponse(201, BUDGET),
    });
    await pickBudgets();
    await press('createBudget');
    expect(outcomeOf('budgets')).toEqual({ ok: true });
    const calls = await sent(fetchFn);
    const post = calls.find(({ route }) => route === 'POST /api/v1/households/doe/budgets');
    expect(post?.body).toEqual({
      name: 'Fun Money',
      targetAmount: 30000,
      currency: 'USD',
      visibility: 'personal',
      targets: [{ categoryId: 'cat' }],
    });
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(2);
    expect(await fetchesOf(fetchFn, 'categories')).toBe(1);
  });

  it('holds the answer until the budgets fetched again are in (OQ-194)', async () => {
    const refetch = deferred();
    let listed = 0;
    await renderExperience({
      ...LISTS,
      'GET /households/doe/budgets': () => {
        listed += 1;
        return listed === 1 ? BUDGETS_LISTED() : refetch.promise;
      },
      'POST /households/doe/budgets': () => jsonResponse(201, BUDGET),
    });
    await pickBudgets();
    await press('createBudget');
    expect(screen.getByTestId('budgets-outcome').textContent).toBe('');
    await settleWith(refetch, BUDGETS_LISTED());
    expect(outcomeOf('budgets')).toEqual({ ok: true });
  });

  it('edits its budget with the changes, address stripped out', async () => {
    const { fetchFn } = await renderExperience({
      ...LISTS, 'PATCH /households/doe/budgets/fun': () => jsonResponse(200, BUDGET),
    });
    await pickBudgets();
    await press('editBudget');
    expect(outcomeOf('budgets')).toEqual({ ok: true });
    const calls = await sent(fetchFn);
    const patch = calls.find(({ route }) => route.startsWith('PATCH'));
    expect(patch?.body).toEqual({
      name: 'Fun', targetAmount: 20000, targets: [{ subcategoryId: 's1' }],
    });
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(2);
  });

  it('deletes its budget and fetches the budgets again', async () => {
    const { fetchFn } = await renderExperience({
      ...LISTS, 'DELETE /households/doe/budgets/fun': () => jsonResponse(204),
    });
    await pickBudgets();
    await press('deleteBudget');
    expect(outcomeOf('budgets')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain('DELETE /api/v1/households/doe/budgets/fun');
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(2);
  });

  it('answers a target claimed meanwhile once the budgets are fetched again (409)', async () => {
    const { fetchFn } = await renderExperience({
      ...LISTS,
      'POST /households/doe/budgets': () => jsonResponse(
        409,
        envelope('budget.target_already_claimed', {
          params: { categoryId: 'cat', budgetId: 'home' },
        }),
      ),
    });
    await pickBudgets();
    await press('createBudget');
    expect(outcomeOf('budgets')).toEqual({
      ok: false,
      error: {
        code: 'budget.target_already_claimed', params: { categoryId: 'cat', budgetId: 'home' },
      },
    });
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(2);
    expect(await fetchesOf(fetchFn, 'categories')).toBe(1);
  });

  it('fetches the categories too when a target was refused as gone (422)', async () => {
    const { fetchFn } = await renderExperience({
      ...LISTS,
      'PATCH /households/doe/budgets/fun': () => jsonResponse(422, envelope('validation.failed')),
    });
    await pickBudgets();
    await press('editBudget');
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(2);
    expect(await fetchesOf(fetchFn, 'categories')).toBe(2);
  });

  it('fetches nothing again after a failure that moved nothing', async () => {
    const { fetchFn } = await renderExperience({
      ...LISTS,
      'DELETE /households/doe/budgets/fun': () => jsonResponse(403, envelope('auth.forbidden')),
    });
    await pickBudgets();
    await press('deleteBudget');
    expect(outcomeOf('budgets')).toEqual({
      ok: false, error: { code: 'auth.forbidden', params: {} },
    });
    expect(await fetchesOf(fetchFn, 'budgets')).toBe(1);
    expect(await fetchesOf(fetchFn, 'categories')).toBe(1);
  });
});

const TRIP: Goal = {
  id: 'trip',
  householdId: 'doe',
  ownerUserId: 'jane',
  name: 'Trip',
  targetAmount: 600000,
  targetCurrency: 'USD',
  dueDate: '2028-04-01',
  visibility: 'shared',
  createdAt: '2026-10-01T00:00:00Z',
  completedAt: null,
};

const CAR: Goal = {
  ...TRIP, id: 'car', name: 'Car', completedAt: '2026-10-10T00:00:00Z',
};

const FUNDING = {
  contributions: [{ holdingId: 'aapl', currency: 'USD' as const, amount: 48200 }],
  fundedBy: [{ holdingId: 'aapl', name: 'AAPL', percentage: 10 }],
};

const TRIP_PROGRESS: GoalWithProgress = { ...TRIP, ...FUNDING };

/**
 * Answers a goal read by its `status` query: the active list or the completed one.
 *
 * @param active - The active list's items.
 * @param completed - The completed list's items.
 * @returns The answer.
 */
const byStatus = (active: unknown[], completed: unknown[]) => (request: Request) => (
  jsonResponse(200, {
    data: new URL(request.url).searchParams.get('status') === 'active' ? active : completed,
  })
);

/** Answers for a Goals tab whose four reads load. */
const GOAL_READS: Answers = {
  'GET /households/doe/goals': byStatus([TRIP], [CAR]),
  'GET /households/doe/goal-progress': byStatus([TRIP_PROGRESS], []),
};

/** Selects the Goals tab so its stub is in front. */
const pickGoals = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Goals' }));
  });
  await settle();
};

/**
 * Lists the goal reads `fetch` got, with their status.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns Each goal read's path and status, e.g. `goals?active`.
 */
const goalReadsOf = (fetchFn: ReturnType<typeof fakeFetch>) => (
  fetchFn.mock.calls.flatMap(([input]) => {
    const request = input as Request;
    const url = new URL(request.url);
    const read = url.pathname.split('/').pop();
    return request.method === 'GET' && (read === 'goals' || read === 'goal-progress')
      ? [`${read}?${url.searchParams.get('status')}`]
      : [];
  })
);

describe('goalListViewOf / progressStatusOf', () => {
  it('joins each goal to its progress by id, and leaves one without it bare', () => {
    expect(goalListViewOf({ data: [TRIP, CAR] }, { data: [TRIP_PROGRESS] })).toEqual({
      status: 'loaded', goals: [{ goal: TRIP, funding: FUNDING }, { goal: CAR }],
    });
  });

  it('shows the definitions alone while the progress read loads or never loaded (OQ-195)', () => {
    const failure = { status: 404, data: envelope('route.not_found') } as never;
    expect(goalListViewOf({ data: [TRIP] }, { error: failure })).toEqual({
      status: 'loaded', goals: [{ goal: TRIP }],
    });
    expect(goalListViewOf({ data: [TRIP] }, {})).toEqual({
      status: 'loaded', goals: [{ goal: TRIP }],
    });
  });

  it('keeps the funding of a progress refetch that failed, and marks the list stale', () => {
    const failure = { status: 'FETCH_ERROR', error: 'down' } as never;
    expect(goalListViewOf({ data: [TRIP] }, { data: [TRIP_PROGRESS], error: failure })).toEqual({
      status: 'loaded',
      goals: [{ goal: TRIP, funding: FUNDING }],
      refreshError: { code: 'internal.unexpected' },
    });
  });

  it('reads the definitions’ loading and failure as the list’s', () => {
    const failure = { status: 'FETCH_ERROR', error: 'down' } as never;
    expect(goalListViewOf({}, { data: [] })).toEqual({ status: 'loading' });
    expect(goalListViewOf({}, { data: [], error: failure })).toEqual({ status: 'loading' });
    expect(goalListViewOf({ error: failure }, { data: [] }).status).toBe('failed');
  });

  it('reads a status’s progress as loaded once it holds data, failed if it never did', () => {
    const failure = { status: 404, data: {} } as never;
    expect(progressStatusOf({ data: [] })).toBe('loaded');
    expect(progressStatusOf({ data: [], error: failure })).toBe('loaded');
    expect(progressStatusOf({ error: failure })).toBe('failed');
    expect(progressStatusOf({})).toBe('loading');
  });
});

describe('the goals it holds for their flow', () => {
  it('reads nothing until the Goals tab opens, then both statuses and their progress', async () => {
    const { fetchFn } = await renderExperience(GOAL_READS);
    expect(goalReadsOf(fetchFn)).toEqual([]);
    await pickGoals();
    expect(goalReadsOf(fetchFn).sort()).toEqual([
      'goal-progress?active', 'goal-progress?completed', 'goals?active', 'goals?completed',
    ]);
  });

  it('hands down both statuses joined to their progress, with the actor', async () => {
    await renderExperience(GOAL_READS);
    await pickGoals();
    expect(shownBy('goals')).toEqual({
      selfUserId: 'jane',
      role: 'Owner',
      goals: {
        active: { status: 'loaded', goals: [{ goal: TRIP, funding: FUNDING }] },
        completed: { status: 'loaded', goals: [{ goal: CAR }] },
        progress: { active: 'loaded', completed: 'loaded' },
      },
    });
  });

  it('hands down the definitions alone while the progress read fails (OQ-195)', async () => {
    await renderExperience({
      ...GOAL_READS,
      'GET /households/doe/goal-progress': () => jsonResponse(404, envelope('route.not_found')),
    });
    await pickGoals();
    expect(shownBy('goals')).toMatchObject({
      goals: {
        active: { status: 'loaded', goals: [{ goal: TRIP }] },
        progress: { active: 'failed', completed: 'failed' },
      },
    });
  });

  it('fetches all four reads again on a retry', async () => {
    const { fetchFn } = await renderExperience(GOAL_READS);
    await pickGoals();
    await press('retry');
    expect(goalReadsOf(fetchFn)).toHaveLength(8);
  });
});

describe('the goal writes it answers for their flow', () => {
  it('creates with only the fields, and answers once the goals are fetched again', async () => {
    const { fetchFn } = await renderExperience({
      ...GOAL_READS, 'POST /households/doe/goals': () => jsonResponse(201, TRIP),
    });
    await pickGoals();
    await press('createGoal');
    expect(outcomeOf('goals')).toEqual({ ok: true });
    const post = (await sent(fetchFn)).find(({ route }) => route.startsWith('POST'));
    expect(post?.body).toEqual({
      name: 'Trip',
      targetAmount: 600000,
      targetCurrency: 'USD',
      dueDate: '2028-04-01',
      visibility: 'shared',
    });
    expect(goalReadsOf(fetchFn)).toHaveLength(8);
  });

  it('holds the answer until the goals fetched again are in', async () => {
    const refetch = deferred();
    let listed = 0;
    await renderExperience({
      ...GOAL_READS,
      'GET /households/doe/goals': (request) => {
        listed += 1;
        return listed <= 2 ? byStatus([TRIP], [CAR])(request) : refetch.promise;
      },
      'POST /households/doe/goals': () => jsonResponse(201, TRIP),
    });
    await pickGoals();
    await press('createGoal');
    expect(screen.getByTestId('goals-outcome').textContent).toBe('');
    await settleWith(refetch, jsonResponse(200, { data: [TRIP] }));
    expect(outcomeOf('goals')).toEqual({ ok: true });
  });

  it('edits its goal with the changes, address stripped out', async () => {
    const { fetchFn } = await renderExperience({
      ...GOAL_READS, 'PATCH /households/doe/goals/trip': () => jsonResponse(200, TRIP),
    });
    await pickGoals();
    await press('editGoal');
    expect(outcomeOf('goals')).toEqual({ ok: true });
    const patch = (await sent(fetchFn)).find(({ route }) => route.startsWith('PATCH'));
    expect(patch?.body).toEqual({
      name: 'Japan', targetAmount: 700000, targetCurrency: 'BRL', dueDate: '2028-05-01',
    });
  });

  it.each([
    ['deleteGoal', 'DELETE /households/doe/goals/trip'],
    ['completeGoal', 'POST /households/doe/goals/trip/complete'],
    ['reopenGoal', 'POST /households/doe/goals/trip/reopen'],
  ])('%s goes to its endpoint and fetches the goals again', async (request, route) => {
    const { fetchFn } = await renderExperience({ ...GOAL_READS, [route]: () => jsonResponse(204) });
    await pickGoals();
    await press(request);
    expect(outcomeOf('goals')).toEqual({ ok: true });
    const [method, path] = route.split(' ');
    expect(await routes(fetchFn)).toContain(`${method} /api/v1${path}`);
    expect(goalReadsOf(fetchFn)).toHaveLength(8);
  });

  it('fetches the goals again when the goal is gone (404)', async () => {
    const { fetchFn } = await renderExperience({
      ...GOAL_READS,
      'POST /households/doe/goals/trip/complete': () => (
        jsonResponse(404, envelope('goal.not_found'))
      ),
    });
    await pickGoals();
    await press('completeGoal');
    expect(outcomeOf('goals')).toEqual({
      ok: false, error: { code: 'goal.not_found', params: {} },
    });
    expect(goalReadsOf(fetchFn)).toHaveLength(8);
  });

  it('leaves a progress read that never loaded to Retry after a write (OQ-195)', async () => {
    const { fetchFn } = await renderExperience({
      ...GOAL_READS,
      'GET /households/doe/goal-progress': () => jsonResponse(404, envelope('route.not_found')),
      'DELETE /households/doe/goals/trip': () => jsonResponse(204),
    });
    await pickGoals();
    await press('deleteGoal');
    expect(outcomeOf('goals')).toEqual({ ok: true });
    expect(goalReadsOf(fetchFn).slice(4).sort()).toEqual(['goals?active', 'goals?completed']);
  });

  it('leaves a progress read that never loaded to Retry after a write (OQ-195)', async () => {
    const { fetchFn } = await renderExperience({
      ...GOAL_READS,
      'GET /households/doe/goal-progress': () => jsonResponse(404, envelope('route.not_found')),
      'DELETE /households/doe/goals/trip': () => jsonResponse(204),
    });
    await pickGoals();
    await press('deleteGoal');
    expect(outcomeOf('goals')).toEqual({ ok: true });
    expect(goalReadsOf(fetchFn).slice(4).sort()).toEqual(['goals?active', 'goals?completed']);
  });

  it('fetches nothing again after a failure that moved nothing', async () => {
    const { fetchFn } = await renderExperience({
      ...GOAL_READS,
      'DELETE /households/doe/goals/trip': () => jsonResponse(403, envelope('auth.forbidden')),
    });
    await pickGoals();
    await press('deleteGoal');
    expect(outcomeOf('goals')).toEqual({
      ok: false, error: { code: 'auth.forbidden', params: {} },
    });
    expect(goalReadsOf(fetchFn)).toHaveLength(4);
  });
});

describe('tabOf', () => {
  it('reads the tab the address names, or Accounts for none or an unknown one', () => {
    expect(tabOf('goals')).toBe('goals');
    expect(tabOf(null)).toBe('accounts');
    expect(tabOf('holdings')).toBe('accounts');
  });
});

/**
 * Tells whether a stub's flow is hidden behind another tab.
 *
 * @param name - The stub's name.
 * @returns Whether its panel is hidden.
 */
const isHidden = (name: string) => screen.getByTestId(name).closest('[hidden]') !== null;

describe('the tabs (OQ-197)', () => {
  it('titles and describes the page after the open section (mockups 40–43)', async () => {
    await renderExperience(LISTS);
    await pickBudgets();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Budgets');
    expect(screen.getByText(
      'Group categories under one monthly spending target. '
      + 'A category can belong to only one budget at a time.',
    )).toBeTruthy();
  });

  it('opens on the tab the address names, mounting no other', async () => {
    await renderExperience(LISTS, true, '/account-setup?tab=budgets');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Budgets');
    expect(isHidden('budgets')).toBe(false);
    expect(screen.queryByTestId('accounts')).toBeNull();
  });

  it('writes the open tab into the address, replacing the entry', async () => {
    await renderExperience(LISTS);
    await pickBudgets();
    const location = screen.getByTestId('location');
    expect(location.textContent).toBe('/account-setup?tab=budgets');
    expect(location.dataset.navigation).toBe('REPLACE');
  });

  it('keeps a tab as it was across a switch, fetching nothing again', async () => {
    const { fetchFn } = await renderExperience({
      ...LISTS,
      'GET /households/doe/accounts': () => jsonResponse(200, { data: [ACCOUNT] }),
    });
    await press('load');
    await pickBudgets();
    expect(isHidden('accounts')).toBe(true);
    expect(isHidden('budgets')).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Accounts' }));
    });
    expect(isHidden('accounts')).toBe(false);
    expect(outcomeOf('accounts')).toEqual({ ok: true, data: [ACCOUNT] });
    expect((await routes(fetchFn)).filter(
      (route) => route === 'GET /api/v1/households/doe/accounts',
    )).toHaveLength(1);
  });

  it('shows Budget Management a category Category Management just wrote', async () => {
    const listed = vi.fn()
      .mockReturnValueOnce(jsonResponse(200, { data: [] }))
      .mockImplementation(CATEGORIES_LISTED);
    await renderExperience({
      ...LISTS,
      'GET /households/doe/categories': listed,
      'POST /households/doe/categories': () => jsonResponse(201, CATEGORY),
    });
    await pickBudgets();
    expect(shownBy('budgets')).toEqual(expect.objectContaining({
      categories: { status: 'loaded', categories: [] },
    }));

    await pickCategories();
    await press('create');
    await pickBudgets();
    expect(shownBy('budgets')).toEqual(expect.objectContaining({
      categories: { status: 'loaded', categories: [CATEGORY] },
    }));
  });
});
