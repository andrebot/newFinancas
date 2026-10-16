import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  manageHouseholdApi, toHouseholdMember, toListedInvitation, useHouseholds,
} from '../../../../src/experiences/manageHousehold/api';
import { fakeStore } from '../../shell/shellFakes';
import { jsonResponse } from '../../api/fakes';
import { fakeFetch, runHook as run } from '../hookFakes';

// The households source the App Shell's gate reads (BDT: the query hook over
// the real store and API client; only `fetch` is fake), and the translation
// of the API's members and invitations into the Flow's shapes (Accessor-like:
// translation only). The endpoints themselves are exercised by the
// Experience's integration test.

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

describe('the members and invitations lists', () => {
  it('reads answers with no list as none', async () => {
    const { store } = fakeStore({
      refreshToken: 'r-0',
      fetchFn: fakeFetch({
        '/households/doe/members': () => jsonResponse(200, {}),
        '/households/doe/invitations': () => jsonResponse(200, {}),
      }),
    });
    const { listMembers, listHouseholdInvitations } = manageHouseholdApi.endpoints;

    const members = store.dispatch(listMembers.initiate('doe'));
    const invitations = store.dispatch(listHouseholdInvitations.initiate('doe'));

    expect((await members).data).toEqual([]);
    expect((await invitations).data).toEqual([]);
    members.unsubscribe();
    invitations.unsubscribe();
  });
});

describe('toHouseholdMember', () => {
  it('keeps what the members list shows, without the household', () => {
    expect(toHouseholdMember({
      userId: 'alex',
      householdId: 'doe',
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex@example.com',
      role: 'Admin',
      joinedAt: '2024-03-01T00:00:00Z',
    })).toEqual({
      userId: 'alex',
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex@example.com',
      role: 'Admin',
      joinedAt: '2024-03-01T00:00:00Z',
    });
  });
});

describe('toListedInvitation', () => {
  it('names the invitation by the invitee’s email', () => {
    expect(toListedInvitation({
      id: 'inv-1',
      householdId: 'doe',
      invitedUserId: 'morgan',
      invitedByUserId: 'jane',
      role: 'Member',
      status: 'pending',
      createdAt: '2026-10-12T00:00:00Z',
      resolvedAt: null,
      inviteeFirstName: 'Morgan',
      inviteeLastName: 'Lee',
      inviteeEmail: 'morgan@example.com',
    })).toEqual({
      id: 'inv-1',
      email: 'morgan@example.com',
      role: 'Member',
      status: 'pending',
      createdAt: '2026-10-12T00:00:00Z',
    });
  });
});
