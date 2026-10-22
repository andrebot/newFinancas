import type {
  Account, Budget, Category, Goal, GoalWithProgress, Subcategory,
} from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import { accountSetupApi } from '../../../../src/experiences/accountSetup/api';
import { jsonResponse } from '../../api/fakes';
import { fakeFetch, sent } from '../experienceFakes';
import { fakeStore } from '../../shell/shellFakes';

// The Account Setup Experience's endpoints (BDT: unit): the real store and API
// client; only `fetch` is fake. Each endpoint is exercised for its route, its
// body — the address stripped out — and what it hands back.

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

describe('listAccounts', () => {
  it('reads the list out of its envelope', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/accounts': () => jsonResponse(200, { data: [ACCOUNT] }),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints.listAccounts.initiate('doe'));

    expect((await list).data).toEqual([ACCOUNT]);
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/accounts': () => jsonResponse(200, {}),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints.listAccounts.initiate('doe'));

    expect((await list).data).toEqual([]);
    list.unsubscribe();
  });
});

describe('createAccount', () => {
  it('posts the request without its address and returns what was written', async () => {
    const fetchFn = fakeFetch({
      'POST /households/doe/accounts': () => jsonResponse(201, ACCOUNT),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const created = store.dispatch(accountSetupApi.endpoints.createAccount.initiate({
      householdId: 'doe',
      name: 'Main Checking',
      type: 'checking',
      currency: 'BRL',
      visibility: 'personal',
      cards: [],
    }));

    expect((await created).data).toEqual(ACCOUNT);
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'POST /api/v1/households/doe/accounts',
      body: {
        name: 'Main Checking', type: 'checking', currency: 'BRL', visibility: 'personal', cards: [],
      },
    });
  });
});

describe('editAccount', () => {
  it('patches the account with only its changes, address stripped out', async () => {
    const renamed = { ...ACCOUNT, name: 'Renamed' };
    const fetchFn = fakeFetch({
      'PATCH /households/doe/accounts/chk': () => jsonResponse(200, renamed),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const edited = store.dispatch(accountSetupApi.endpoints.editAccount.initiate({
      householdId: 'doe', accountId: 'chk', name: 'Renamed',
    }));

    expect((await edited).data).toEqual(renamed);
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual(
      { route: 'PATCH /api/v1/households/doe/accounts/chk', body: { name: 'Renamed' } },
    );
  });
});

describe('archiveAccount', () => {
  it('posts the archive with no body and returns nothing', async () => {
    const fetchFn = fakeFetch({
      'POST /households/doe/accounts/chk/archive': () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const archived = store.dispatch(accountSetupApi.endpoints.archiveAccount.initiate({
      householdId: 'doe', accountId: 'chk',
    }));

    expect((await archived).data).toBeNull();
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual(
      { route: 'POST /api/v1/households/doe/accounts/chk/archive', body: undefined },
    );
  });
});

const SUB: Subcategory = {
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

describe('listCategories', () => {
  it('reads the list out of its envelope, archived included', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/categories': () => jsonResponse(200, { data: [CATEGORY] }),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints.listCategories.initiate('doe'));

    expect((await list).data).toEqual([CATEGORY]);
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/categories': () => jsonResponse(200, {}),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints.listCategories.initiate('doe'));

    expect((await list).data).toEqual([]);
    list.unsubscribe();
  });
});

describe('createCategory', () => {
  it('posts the request without its address and returns what was written', async () => {
    const fetchFn = fakeFetch({
      'POST /households/doe/categories': () => jsonResponse(201, CATEGORY),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const created = store.dispatch(accountSetupApi.endpoints.createCategory.initiate({
      householdId: 'doe', name: 'Housing', icon: 'home-outline', color: 'mint',
    }));

    expect((await created).data).toEqual(CATEGORY);
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'POST /api/v1/households/doe/categories',
      body: { name: 'Housing', icon: 'home-outline', color: 'mint' },
    });
  });
});

describe('editCategory', () => {
  it('patches the category with only its changes, address stripped out', async () => {
    const renamed = { ...CATEGORY, name: 'Renamed' };
    const fetchFn = fakeFetch({
      'PATCH /households/doe/categories/cat': () => jsonResponse(200, renamed),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const edited = store.dispatch(accountSetupApi.endpoints.editCategory.initiate({
      householdId: 'doe', categoryId: 'cat', name: 'Renamed',
    }));

    expect((await edited).data).toEqual(renamed);
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual(
      { route: 'PATCH /api/v1/households/doe/categories/cat', body: { name: 'Renamed' } },
    );
  });

  it('adds a subcategory in the same patch (OQ-173)', async () => {
    const grown = { ...CATEGORY, subcategories: [SUB, { ...SUB, id: 's2', name: 'Parking' }] };
    const fetchFn = fakeFetch({
      'PATCH /households/doe/categories/cat': () => jsonResponse(200, grown),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const edited = store.dispatch(accountSetupApi.endpoints.editCategory.initiate({
      householdId: 'doe', categoryId: 'cat', subcategories: [{ name: 'Parking' }],
    }));

    expect((await edited).data).toEqual(grown);
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'PATCH /api/v1/households/doe/categories/cat',
      body: { subcategories: [{ name: 'Parking' }] },
    });
  });
});

describe('archiveCategory', () => {
  it('posts the archive with no body and returns nothing', async () => {
    const fetchFn = fakeFetch({
      'POST /households/doe/categories/cat/archive': () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const archived = store.dispatch(accountSetupApi.endpoints.archiveCategory.initiate({
      householdId: 'doe', categoryId: 'cat',
    }));

    expect((await archived).data).toBeNull();
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual(
      { route: 'POST /api/v1/households/doe/categories/cat/archive', body: undefined },
    );
  });
});

describe('archiveSubcategory', () => {
  it('posts the archive with no body and returns nothing', async () => {
    const fetchFn = fakeFetch({
      'POST /households/doe/categories/cat/subcategories/s1/archive': () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const archived = store.dispatch(accountSetupApi.endpoints.archiveSubcategory.initiate({
      householdId: 'doe', categoryId: 'cat', subcategoryId: 's1',
    }));

    expect((await archived).data).toBeNull();
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'POST /api/v1/households/doe/categories/cat/subcategories/s1/archive',
      body: undefined,
    });
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

describe('listBudgets', () => {
  it('reads the list out of its envelope', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/budgets': () => jsonResponse(200, { data: [BUDGET] }),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints.listBudgets.initiate('doe'));

    expect((await list).data).toEqual([BUDGET]);
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({ 'GET /households/doe/budgets': () => jsonResponse(200, {}) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints.listBudgets.initiate('doe'));

    expect((await list).data).toEqual([]);
    list.unsubscribe();
  });
});

describe('createBudget', () => {
  it('posts the request without its address and returns what was written', async () => {
    const fetchFn = fakeFetch({ 'POST /households/doe/budgets': () => jsonResponse(201, BUDGET) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const created = store.dispatch(accountSetupApi.endpoints.createBudget.initiate({
      householdId: 'doe',
      name: 'Fun Money',
      targetAmount: 30000,
      currency: 'USD',
      visibility: 'personal',
      targets: [{ categoryId: 'cat' }],
    }));

    expect((await created).data).toEqual(BUDGET);
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'POST /api/v1/households/doe/budgets',
      body: {
        name: 'Fun Money',
        targetAmount: 30000,
        currency: 'USD',
        visibility: 'personal',
        targets: [{ categoryId: 'cat' }],
      },
    });
  });
});

describe('editBudget', () => {
  it('patches the budget with only its changes, address stripped out', async () => {
    const fetchFn = fakeFetch({
      'PATCH /households/doe/budgets/fun': () => jsonResponse(200, BUDGET),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const edited = store.dispatch(accountSetupApi.endpoints.editBudget.initiate({
      householdId: 'doe', budgetId: 'fun', name: 'Fun', targets: [{ subcategoryId: 's1' }],
    }));

    expect((await edited).data).toEqual(BUDGET);
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'PATCH /api/v1/households/doe/budgets/fun',
      body: { name: 'Fun', targets: [{ subcategoryId: 's1' }] },
    });
  });
});

describe('deleteBudget', () => {
  it('deletes the budget with no body and returns nothing', async () => {
    const fetchFn = fakeFetch({ 'DELETE /households/doe/budgets/fun': () => jsonResponse(204) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const deleted = store.dispatch(accountSetupApi.endpoints.deleteBudget.initiate({
      householdId: 'doe', budgetId: 'fun',
    }));

    expect((await deleted).data).toBeNull();
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'DELETE /api/v1/households/doe/budgets/fun', body: undefined,
    });
  });
});

const GOAL: Goal = {
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

const GOAL_PROGRESS: GoalWithProgress = {
  ...GOAL,
  contributions: [{ holdingId: 'aapl', currency: 'USD', amount: 48200 }],
  fundedBy: [{ holdingId: 'aapl', name: 'AAPL', percentage: 10 }],
};

describe.each([
  ['listGoals', 'goals', GOAL],
  ['listGoalProgress', 'goal-progress', GOAL_PROGRESS],
] as const)('%s', (endpoint, path, item) => {
  it('asks for one status and reads the list out of its envelope', async () => {
    const fetchFn = fakeFetch({
      [`GET /households/doe/${path}`]: () => jsonResponse(200, { data: [item] }),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints[endpoint].initiate({
      householdId: 'doe', status: 'completed',
    }));

    expect((await list).data).toEqual([item]);
    const [input] = fetchFn.mock.calls[0] ?? [];
    expect(new URL((input as Request).url).search).toBe('?status=completed');
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({ [`GET /households/doe/${path}`]: () => jsonResponse(200, {}) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(accountSetupApi.endpoints[endpoint].initiate({
      householdId: 'doe', status: 'active',
    }));

    expect((await list).data).toEqual([]);
    list.unsubscribe();
  });
});

describe('createGoal', () => {
  it('posts the request without its address and returns what was written', async () => {
    const fetchFn = fakeFetch({ 'POST /households/doe/goals': () => jsonResponse(201, GOAL) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const created = store.dispatch(accountSetupApi.endpoints.createGoal.initiate({
      householdId: 'doe',
      name: 'Trip',
      targetAmount: 600000,
      targetCurrency: 'USD',
      dueDate: '2028-04-01',
      visibility: 'shared',
    }));

    expect((await created).data).toEqual(GOAL);
    expect((await sent(fetchFn))[0]).toEqual({
      route: 'POST /api/v1/households/doe/goals',
      body: {
        name: 'Trip',
        targetAmount: 600000,
        targetCurrency: 'USD',
        dueDate: '2028-04-01',
        visibility: 'shared',
      },
    });
  });
});

describe('editGoal', () => {
  it('patches the goal with only its changes, address stripped out', async () => {
    const fetchFn = fakeFetch({
      'PATCH /households/doe/goals/trip': () => jsonResponse(200, GOAL),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const edited = store.dispatch(accountSetupApi.endpoints.editGoal.initiate({
      householdId: 'doe', goalId: 'trip', name: 'Japan',
    }));

    expect((await edited).data).toEqual(GOAL);
    expect((await sent(fetchFn))[0]).toEqual({
      route: 'PATCH /api/v1/households/doe/goals/trip', body: { name: 'Japan' },
    });
  });
});

describe.each([
  ['deleteGoal', 'DELETE', ''],
  ['completeGoal', 'POST', '/complete'],
  ['reopenGoal', 'POST', '/reopen'],
] as const)('%s', (endpoint, method, suffix) => {
  it('goes to its route with no body and returns nothing', async () => {
    const fetchFn = fakeFetch({
      [`${method} /households/doe/goals/trip${suffix}`]: () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const done = store.dispatch(accountSetupApi.endpoints[endpoint].initiate({
      householdId: 'doe', goalId: 'trip',
    }));

    expect((await done).data).toBeNull();
    expect((await sent(fetchFn))[0]).toEqual({
      route: `${method} /api/v1/households/doe/goals/trip${suffix}`, body: undefined,
    });
  });
});
