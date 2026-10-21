import type { Account, Category, Subcategory } from '@financas/api-types';
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
