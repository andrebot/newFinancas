import type { Account } from '@financas/api-types';
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
