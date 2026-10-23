import type {
  Account, Budget, Category, Subcategory,
} from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import { setupApi, useAccountInUse } from '../../../src/api/setupApi';
import { envelope, jsonResponse } from './fakes';
import { fakeFetch, sent, settle } from '../experiences/experienceFakes';
import { runHook } from '../experiences/hookFakes';
import { fakeStore } from '../shell/shellFakes';

// The shared household setup endpoints (BDT: unit): the real store and API
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
    const list = store.dispatch(setupApi.endpoints.listAccounts.initiate('doe'));

    expect((await list).data).toEqual([ACCOUNT]);
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/accounts': () => jsonResponse(200, {}),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(setupApi.endpoints.listAccounts.initiate('doe'));

    expect((await list).data).toEqual([]);
    list.unsubscribe();
  });
});

describe('getAccountStatus', () => {
  it.each([true, false])('reads whether one is in use: %s', async (inUse) => {
    const fetchFn = fakeFetch({
      'GET /households/doe/account-status': () => jsonResponse(200, { inUse }),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const read = store.dispatch(setupApi.endpoints.getAccountStatus.initiate('doe'));

    expect((await read).data).toBe(inUse);
    read.unsubscribe();
  });

  it.each([
    ['a create', 'POST /households/doe/accounts', () => jsonResponse(201, ACCOUNT)],
    ['an archive', 'POST /households/doe/accounts/chk/archive', () => jsonResponse(204)],
  ])('is asked again after %s goes through, not after one fails (OQ-198)', async (
    _write,
    route,
    succeed,
  ) => {
    let fails = true;
    const fetchFn = fakeFetch({
      'GET /households/doe/account-status': () => jsonResponse(200, { inUse: false }),
      [route]: () => (fails ? jsonResponse(422, envelope('validation.failed')) : succeed()),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const read = store.dispatch(setupApi.endpoints.getAccountStatus.initiate('doe'));
    await read;
    /**
     * Sends the write.
     *
     * @returns Its result.
     */
    const write = () => (route.endsWith('archive')
      ? store.dispatch(setupApi.endpoints.archiveAccount.initiate({
        householdId: 'doe', accountId: 'chk',
      }))
      : store.dispatch(setupApi.endpoints.createAccount.initiate({
        householdId: 'doe',
        name: 'Main',
        type: 'checking',
        currency: 'BRL',
        visibility: 'shared',
        cards: [],
      })));
    /** Counts the status reads sent so far. */
    const reads = async () => (await sent(fetchFn))
      .filter((call) => call.route === 'GET /api/v1/households/doe/account-status').length;

    await write();
    expect(await reads()).toBe(1);
    fails = false;
    await write();
    await vi.waitFor(async () => expect(await reads()).toBe(2));
    read.unsubscribe();
  });

  it('is the shell source the household gate reads', async () => {
    const result = runHook(() => useAccountInUse('doe'), fakeFetch({
      'GET /households/doe/account-status': () => jsonResponse(200, { inUse: true }),
    }));
    expect(result.current).toEqual({ status: 'loading' });

    await vi.waitFor(() => expect(result.current).toEqual({ status: 'ready', data: true }));
  });

  it('asks nothing until there is a household to ask about', async () => {
    const fetchFn = fakeFetch({});
    const result = runHook(() => useAccountInUse(undefined), fetchFn);

    await settle();

    expect(result.current).toEqual({ status: 'loading' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('createAccount', () => {
  it('posts the request without its address and returns what was written', async () => {
    const fetchFn = fakeFetch({
      'POST /households/doe/accounts': () => jsonResponse(201, ACCOUNT),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const created = store.dispatch(setupApi.endpoints.createAccount.initiate({
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
    const edited = store.dispatch(setupApi.endpoints.editAccount.initiate({
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
    const archived = store.dispatch(setupApi.endpoints.archiveAccount.initiate({
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
    const list = store.dispatch(setupApi.endpoints.listCategories.initiate('doe'));

    expect((await list).data).toEqual([CATEGORY]);
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({
      'GET /households/doe/categories': () => jsonResponse(200, {}),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(setupApi.endpoints.listCategories.initiate('doe'));

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
    const created = store.dispatch(setupApi.endpoints.createCategory.initiate({
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
    const edited = store.dispatch(setupApi.endpoints.editCategory.initiate({
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
    const edited = store.dispatch(setupApi.endpoints.editCategory.initiate({
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
    const archived = store.dispatch(setupApi.endpoints.archiveCategory.initiate({
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
    const archived = store.dispatch(setupApi.endpoints.archiveSubcategory.initiate({
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
    const list = store.dispatch(setupApi.endpoints.listBudgets.initiate('doe'));

    expect((await list).data).toEqual([BUDGET]);
    list.unsubscribe();
  });

  it('reads an answer with no list as none', async () => {
    const fetchFn = fakeFetch({ 'GET /households/doe/budgets': () => jsonResponse(200, {}) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const list = store.dispatch(setupApi.endpoints.listBudgets.initiate('doe'));

    expect((await list).data).toEqual([]);
    list.unsubscribe();
  });
});

describe('createBudget', () => {
  it('posts the request without its address and returns what was written', async () => {
    const fetchFn = fakeFetch({ 'POST /households/doe/budgets': () => jsonResponse(201, BUDGET) });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const created = store.dispatch(setupApi.endpoints.createBudget.initiate({
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
    const edited = store.dispatch(setupApi.endpoints.editBudget.initiate({
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
    const deleted = store.dispatch(setupApi.endpoints.deleteBudget.initiate({
      householdId: 'doe', budgetId: 'fun',
    }));

    expect((await deleted).data).toBeNull();
    const calls = await sent(fetchFn);
    expect(calls[0]).toEqual({
      route: 'DELETE /api/v1/households/doe/budgets/fun', body: undefined,
    });
  });
});
