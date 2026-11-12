import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { identityApi, useHouseholds } from '../../../src/api/identityApi';
import { manageHouseholdApi } from '../../../src/experiences/manageHousehold/api';
import { fakeFetch, runHook as run } from '../experiences/hookFakes';
import { fakeStore } from '../shell/shellFakes';
import { jsonResponse } from './fakes';

// The shared identity reads (OQ-163): the households source the App Shell's
// gate reads (BDT: the query hook over the real store and API client; only
// `fetch` is fake). The current user is exercised through the Experiences
// that read it. The members list (slice 4 review, A1) through the real store:
// its answer, and the Manage Household write that makes it stale.

describe('useHouseholds', () => {
  it('gives the households with the user’s role in each', async () => {
    const doe = {
      id: 'doe', name: 'The Doe Household', createdAt: '2026-01-01T00:00:00Z', role: 'Owner',
    };
    const result = run(useHouseholds, fakeFetch({
      '/households': () => jsonResponse(200, { data: [doe] }),
    }));

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: [doe] }));
  });

  it('reads an answer with no list as none', async () => {
    const result = run(useHouseholds, fakeFetch({ '/households': () => jsonResponse(200, {}) }));

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: [] }));
  });
});

describe('listMembers', () => {
  const ALEX = {
    userId: 'alex',
    householdId: 'doe',
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex@example.com',
    role: 'Admin',
    joinedAt: '2024-03-01T00:00:00Z',
  };

  it('gives the household\'s members, and an answer with no list as none', async () => {
    const fetchFn = fakeFetch({
      '/households/doe/members': () => jsonResponse(200, { data: [ALEX] }),
      '/households/ray/members': () => jsonResponse(200, {}),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const doe = store.dispatch(identityApi.endpoints.listMembers.initiate('doe'));
    const ray = store.dispatch(identityApi.endpoints.listMembers.initiate('ray'));

    expect((await doe).data).toEqual([ALEX]);
    expect((await ray).data).toEqual([]);
    doe.unsubscribe();
    ray.unsubscribe();
  });

  it('is read again after Manage Household changes a member\'s role', async () => {
    const fetchFn = fakeFetch({
      '/households/doe/members': () => jsonResponse(200, { data: [ALEX] }),
      '/households/doe/members/alex/role': () => jsonResponse(204),
    });
    const { store } = fakeStore({ refreshToken: 'r-0', fetchFn });
    const members = store.dispatch(identityApi.endpoints.listMembers.initiate('doe'));
    await members;

    await store.dispatch(manageHouseholdApi.endpoints.changeMemberRole.initiate({
      householdId: 'doe', userId: 'alex', role: 'Member',
    }));

    await waitFor(() => expect(fetchFn.mock.calls.filter(([input]) => (
      new URL((input as Request).url).pathname.endsWith('/households/doe/members')
    ))).toHaveLength(2));
    members.unsubscribe();
  });
});
