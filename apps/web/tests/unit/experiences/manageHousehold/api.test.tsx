import { describe, expect, it } from 'vitest';
import { manageHouseholdApi, toListedInvitation } from '../../../../src/experiences/manageHousehold/api';
import { fakeStore } from '../../shell/shellFakes';
import { jsonResponse } from '../../api/fakes';
import { fakeFetch } from '../hookFakes';

// The translation of the API's invitations into the Flow's shape
// (Accessor-like: translation only). The endpoints themselves are exercised
// by the Experience's integration test; the members list is a shared identity
// read (`api/identityApi.ts`, slice 4 review A1).

describe('the invitations list', () => {
  it('reads an answer with no list as none', async () => {
    const { store } = fakeStore({
      refreshToken: 'r-0',
      fetchFn: fakeFetch({ '/households/doe/invitations': () => jsonResponse(200, {}) }),
    });
    const invitations = store.dispatch(
      manageHouseholdApi.endpoints.listHouseholdInvitations.initiate('doe'),
    );

    expect((await invitations).data).toEqual([]);
    invitations.unsubscribe();
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
