import { screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type {
  HouseholdDeletionFlowProps,
} from '../../../../src/experiences/manageHousehold/flows/householdDeletion/HouseholdDeletionFlow';
import type {
  MembershipManagementFlowProps,
} from '../../../../src/experiences/manageHousehold/flows/membershipManagement/MembershipManagementFlow';
import type {
  LeaveHouseholdProps,
} from '../../../../src/experiences/manageHousehold/interactions/LeaveHousehold';
import {
  invitationsOf, ManageHouseholdExperience,
} from '../../../../src/experiences/manageHousehold/ManageHouseholdExperience';
import {
  householdChosen, selectActiveHouseholdId, switchHousehold,
} from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  deferred, fakeFetch, outcomeOf, press, sent, settle, settleWith, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// Experience (BDT: integration). The Flows and the standalone Interaction it
// composes are stubs: plain buttons that make each request with fixed input
// and show what they were given and the outcome they got back. Beneath it,
// the real store and API client; only `fetch` is fake.

vi.mock(
  '../../../../src/experiences/manageHousehold/flows/membershipManagement/MembershipManagementFlow',
  () => ({
    /**
     * Membership Management's stand-in.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    MembershipManagementFlow: ({
      selfUserId, onLoad, onChangeRole, onRemoveMember, onTransferOwnership, onInvite,
      onRevokeInvitation,
    }: MembershipManagementFlowProps) => (
      <Stub
        name="membership"
        shows={{ selfUserId }}
        requests={{
          load: onLoad,
          role: () => onChangeRole('sam', 'Viewer'),
          remove: () => onRemoveMember('sam'),
          transfer: () => onTransferOwnership('alex'),
          invite: () => onInvite({ email: 'morgan@example.com', role: 'Member' }),
          revoke: () => onRevokeInvitation('inv-1'),
        }}
      />
    ),
  }),
);

vi.mock(
  '../../../../src/experiences/manageHousehold/flows/householdDeletion/HouseholdDeletionFlow',
  () => ({
    /**
     * Household Deletion's stand-in.
     *
     * @param props - What the Experience passes.
     * @returns The stub.
     */
    HouseholdDeletionFlow: ({ householdName, onDelete }: HouseholdDeletionFlowProps) => (
      <Stub name="deletion" shows={{ householdName }} requests={{ delete: onDelete }} />
    ),
  }),
);

vi.mock('../../../../src/experiences/manageHousehold/interactions/LeaveHousehold', () => ({
  /**
   * Leave Household's stand-in.
   *
   * @param props - What the Experience passes.
   * @returns The stub.
   */
  LeaveHousehold: ({
    householdName, consequence, busy, alert, onLeave,
  }: LeaveHouseholdProps) => (
    <Stub
      name="leave"
      shows={{
        householdName, consequence, busy, alert,
      }}
      events={{ leave: onLeave }}
    />
  ),
}));

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

const SMITH = {
  id: 'smith', name: 'The Smith Household', createdAt: '2025-01-01T00:00:00Z', role: 'Member',
};

/**
 * Builds a listed membership of Doe.
 *
 * @param userId - The member, also their first name in lower case.
 * @param role - Their role.
 * @param joinedAt - When they joined.
 * @returns The membership, as the API lists it.
 */
const membership = (userId: string, role: string, joinedAt: string) => ({
  userId,
  householdId: 'doe',
  firstName: userId.charAt(0).toUpperCase() + userId.slice(1),
  lastName: 'Doe',
  email: `${userId}@example.com`,
  role,
  joinedAt,
});

const MEMBERS = [
  membership('jane', 'Owner', '2024-01-01T00:00:00Z'),
  membership('alex', 'Admin', '2024-03-01T00:00:00Z'),
  membership('sam', 'Member', '2025-06-01T00:00:00Z'),
  membership('priya', 'Viewer', '2026-02-01T00:00:00Z'),
];

const INVITATION = {
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
};

/** Answers for a page that loads: Jane, Owner of Doe and a Member of Smith. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, USER),
  'GET /households': () => jsonResponse(200, { data: [DOE, SMITH] }),
  'GET /households/doe/members': () => jsonResponse(200, { data: MEMBERS }),
  'GET /households/doe/invitations': () => jsonResponse(200, { data: [INVITATION] }),
};

/**
 * Renders the Experience over the real store, signed in with Doe active.
 *
 * @param answers - The API's answers, over the loaded page's.
 * @param loads - Whether to wait for the page to show.
 * @returns The store and the fake `fetch`.
 */
const renderExperience = async (answers: Answers = {}, loads = true) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <ManageHouseholdExperience />
    </AlertProvider>,
    store,
    { path: '/household' },
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

const location = () => screen.getByTestId('location').textContent;

describe('invitationsOf', () => {
  it('takes a forbidden list as none, and any other failure as one', () => {
    const forbidden = { status: 403, code: 'auth.forbidden', correlationId: 'cid-1' };
    const broken = { status: 500, code: 'internal.unexpected', correlationId: 'cid-1' };

    expect(invitationsOf({ data: [] })).toEqual([]);
    expect(invitationsOf({ error: forbidden })).toEqual([]);
    expect(invitationsOf({ error: broken })).toEqual({ code: 'internal.unexpected' });
  });
});

describe('ManageHouseholdExperience — the page', () => {
  it('shows a skeleton until the user loads', async () => {
    const pending = deferred();
    await renderExperience({ 'GET /users/me': () => pending.promise }, false);

    expect(screen.getByRole('status', { name: 'Loading the household' })).toBeTruthy();
    await settleWith(pending, jsonResponse(200, USER));
    expect(screen.getByRole('heading', { level: 1, name: 'The Doe Household' })).toBeTruthy();
  });

  it('names the household and counts its members', async () => {
    await renderExperience();

    expect(screen.getByText('Household')).toBeTruthy();
    expect(screen.getByText(
      '4 members · shared accounts, budgets, and goals are visible to everyone here.',
    )).toBeTruthy();
    expect(shownBy('membership')).toEqual({ selfUserId: 'jane' });
  });

  it('waits for the members before counting them or offering to leave', async () => {
    const pending = deferred();
    await renderExperience({ 'GET /households/doe/members': () => pending.promise });

    expect(screen.queryByText(/members ·/)).toBeNull();
    expect(screen.queryByTestId('leave')).toBeNull();
    await settleWith(pending, jsonResponse(200, { data: MEMBERS }));
    expect(screen.getByTestId('leave')).toBeTruthy();
  });

  it('offers a retry when the user can’t load', async () => {
    let answer = () => jsonResponse(500, envelope('internal.unexpected'));
    await renderExperience({ 'GET /users/me': () => answer() }, false);
    await settle();
    expect(screen.getByText("Couldn't load the household.")).toBeTruthy();

    answer = () => jsonResponse(200, USER);
    await press('Try again');

    expect(screen.getByRole('heading', { level: 1, name: 'The Doe Household' })).toBeTruthy();
  });

  it('starts afresh for another household once the shell switches', async () => {
    const { store, fetchFn } = await renderExperience({
      'GET /households/smith/members': () => jsonResponse(200, {
        data: [{ ...MEMBERS[1], householdId: 'smith' }],
      }),
    });

    store.dispatch(switchHousehold('smith'));
    await settle();
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'The Smith Household' })).toBeTruthy();
    expect(screen.getByText(/1 member ·/)).toBeTruthy();
    expect(screen.queryByTestId('deletion')).toBeNull();
    expect(await routes(fetchFn)).toContain('GET /api/v1/households/smith/members');
  });
});

describe('ManageHouseholdExperience — membership', () => {
  it('loads the members and the pending invitations for the Flow', async () => {
    await renderExperience();

    await press('load');

    expect(outcomeOf('membership')).toEqual({
      ok: true,
      members: MEMBERS.map(({ householdId: _, ...member }) => member),
      invitations: [{
        id: 'inv-1',
        email: 'morgan@example.com',
        role: 'Member',
        status: 'pending',
        createdAt: '2026-10-12T00:00:00Z',
      }],
    });
  });

  it('gives a Member or Viewer the members alone', async () => {
    await renderExperience({
      'GET /households/doe/invitations': () => jsonResponse(403, envelope('auth.forbidden')),
    });

    await press('load');

    expect(outcomeOf('membership')).toMatchObject({ ok: true, invitations: [] });
  });

  it('hands the Flow a failed load', async () => {
    await renderExperience({
      'GET /households/doe/members': () => jsonResponse(404, envelope('household.not_found')),
    });

    await press('load');

    expect(outcomeOf('membership')).toMatchObject({
      ok: false, error: { code: 'household.not_found' },
    });
  });

  it('hands the Flow invitations that failed for another reason', async () => {
    await renderExperience({
      'GET /households/doe/invitations': () => jsonResponse(500, envelope('internal.unexpected')),
    });

    await press('load');

    expect(outcomeOf('membership')).toMatchObject({
      ok: false, error: { code: 'internal.unexpected' },
    });
  });

  it('changes a role, then counts the members again', async () => {
    const { fetchFn } = await renderExperience({
      'PATCH /households/doe/members/sam/role': () => jsonResponse(200, {}),
    });

    await press('role');

    expect(outcomeOf('membership')).toEqual({ ok: true });
    const calls = await sent(fetchFn);
    expect(calls.find(({ route }) => route.startsWith('PATCH'))).toEqual({
      route: 'PATCH /api/v1/households/doe/members/sam/role', body: { role: 'Viewer' },
    });
    expect(calls.at(-1)?.route).toBe('GET /api/v1/households/doe/members');
  });

  it('hands the Flow a refused change', async () => {
    await renderExperience({
      'PATCH /households/doe/members/sam/role': () => (
        jsonResponse(409, envelope('household.changed'))
      ),
    });

    await press('role');

    expect(outcomeOf('membership')).toMatchObject({
      ok: false, error: { code: 'household.changed' },
    });
  });

  it('removes a member, and the header counts one fewer', async () => {
    let members = MEMBERS;
    const { fetchFn } = await renderExperience({
      'GET /households/doe/members': () => jsonResponse(200, { data: members }),
      'DELETE /households/doe/members/sam': () => {
        members = MEMBERS.filter(({ userId }) => userId !== 'sam');
        return jsonResponse(204);
      },
    });

    await press('remove');
    await settle();

    expect(outcomeOf('membership')).toEqual({ ok: true });
    expect(await routes(fetchFn)).toContain('DELETE /api/v1/households/doe/members/sam');
    expect(screen.getByText(/^3 members ·/)).toBeTruthy();
  });

  it('transfers ownership; the danger zone goes with the Owner role', async () => {
    let households = [DOE, SMITH];
    const { fetchFn } = await renderExperience({
      'GET /households': () => jsonResponse(200, { data: households }),
      'POST /households/doe/transfer-ownership': () => {
        households = [{ ...DOE, role: 'Admin' }, SMITH];
        return jsonResponse(200, {});
      },
    });
    expect(shownBy('deletion')).toEqual({ householdName: 'The Doe Household' });

    await press('transfer');
    await settle();

    expect(outcomeOf('membership')).toEqual({ ok: true });
    expect((await sent(fetchFn)).find(({ route }) => route.includes('transfer'))).toEqual({
      route: 'POST /api/v1/households/doe/transfer-ownership', body: { targetUserId: 'alex' },
    });
    expect(screen.queryByTestId('deletion')).toBeNull();
  });

  it('sends an invite and hands the Flow the invitation', async () => {
    const { fetchFn } = await renderExperience({
      'POST /households/doe/invitations': () => jsonResponse(201, {
        ...INVITATION, id: 'inv-2', inviteeEmail: undefined,
      }),
    });

    await press('invite');

    expect(outcomeOf('membership')).toEqual({
      ok: true, invitation: { id: 'inv-2', role: 'Member', createdAt: '2026-10-12T00:00:00Z' },
    });
    expect((await sent(fetchFn)).at(-1)).toEqual({
      route: 'POST /api/v1/households/doe/invitations',
      body: { email: 'morgan@example.com', role: 'Member' },
    });
  });

  it('hands the Flow a refused invite', async () => {
    await renderExperience({
      'POST /households/doe/invitations': () => (
        jsonResponse(404, envelope('invitation.invitee_not_registered'))
      ),
    });

    await press('invite');

    expect(outcomeOf('membership')).toMatchObject({
      ok: false, error: { code: 'invitation.invitee_not_registered' },
    });
  });

  it('revokes an invitation', async () => {
    const { fetchFn } = await renderExperience({
      'DELETE /households/doe/invitations/inv-1': () => jsonResponse(204),
    });

    await press('revoke');

    expect(outcomeOf('membership')).toEqual({ ok: true });
    expect((await routes(fetchFn)).at(-1)).toBe('DELETE /api/v1/households/doe/invitations/inv-1');
  });
});

describe('ManageHouseholdExperience — leave', () => {
  it('tells Leave Household who takes over from the Owner', async () => {
    await renderExperience();

    expect(shownBy('leave')).toEqual({
      householdName: 'The Doe Household',
      consequence: { kind: 'successor', name: 'Alex Doe' },
      busy: false,
    });
  });

  it('leaves, toasts it and lands on the next household’s Dashboard', async () => {
    let households = [DOE, SMITH];
    const { store, fetchFn } = await renderExperience({
      'GET /households': () => jsonResponse(200, { data: households }),
      'DELETE /households/doe/members/jane': () => {
        households = [SMITH];
        return jsonResponse(204);
      },
    });

    await press('leave');
    await settle();

    expect(await routes(fetchFn)).toContain('DELETE /api/v1/households/doe/members/jane');
    expect(screen.getByText('You left The Doe Household.')).toBeTruthy();
    expect(selectActiveHouseholdId(store.getState())).toBe('smith');
    expect(location()).toBe('/');
  });

  it('is busy while the leave is out', async () => {
    const pending = deferred();
    await renderExperience({ 'DELETE /households/doe/members/jane': () => pending.promise });

    await press('leave');

    expect(shownBy('leave')).toMatchObject({ busy: true });
    await settleWith(pending, jsonResponse(409, envelope('household.changed')));
  });

  it('shows a refused leave in the card and stays', async () => {
    await renderExperience({
      'DELETE /households/doe/members/jane': () => jsonResponse(409, envelope('household.changed')),
    });

    await press('leave');

    expect(shownBy('leave')).toMatchObject({
      busy: false,
      alert: 'The members of this household changed while you were editing. Please try again.',
    });
    expect(location()).toBe('/household');
  });
});

describe('ManageHouseholdExperience — delete household', () => {
  it('deletes, toasts it and sends the user with no household left to Onboard', async () => {
    let households = [DOE];
    await renderExperience({
      'GET /households': () => jsonResponse(200, { data: households }),
      'DELETE /households/doe': () => {
        households = [];
        return jsonResponse(204);
      },
    });

    await press('delete');
    await settle();

    expect(screen.getByText('The Doe Household was deleted.')).toBeTruthy();
    expect(location()).toBe('/setup');
  });

  it('hands the Flow a refused deletion and stays', async () => {
    await renderExperience({
      'DELETE /households/doe': () => jsonResponse(403, envelope('auth.forbidden')),
    });

    await press('delete');

    expect(outcomeOf('deletion')).toMatchObject({ ok: false, error: { code: 'auth.forbidden' } });
    expect(location()).toBe('/household');
  });
});
