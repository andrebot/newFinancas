import { describe, expect, it } from 'vitest';
import {
  afterAction, afterLoad, confirmCancelled, confirmOpened, fullName, INITIAL_MEMBERSHIP, loading,
  managesMembers, needsReload, pendingOnly, selfRole, sortMembers, started,
  type HouseholdMember, type ListedInvitation, type MembershipState, type MembershipView,
} from '../../../../../../src/experiences/manageHousehold/flows/membershipManagement/membershipState';

// Flow state (BDT: unit, pure — nothing to mock).

/**
 * Builds a member.
 *
 * @param userId - Their id (also their first name).
 * @param role - Their role.
 * @param joinedAt - When they joined.
 * @returns The member.
 */
const member = (
  userId: string,
  role: HouseholdMember['role'],
  joinedAt = '2025-01-01T00:00:00Z',
): HouseholdMember => ({
  userId, firstName: userId, lastName: 'Doe', email: `${userId}@example.com`, role, joinedAt,
});

/**
 * Builds a listed invitation.
 *
 * @param id - Its id.
 * @param status - Its status.
 * @param createdAt - When it was sent.
 * @returns The invitation.
 */
const invitation = (
  id: string,
  status: ListedInvitation['status'],
  createdAt: string,
): ListedInvitation => ({
  id, email: `${id}@example.com`, role: 'Member', createdAt, status,
});

const JANE = member('jane', 'Owner', '2024-01-01T00:00:00Z');
const ALEX = member('alex', 'Admin', '2024-03-01T00:00:00Z');
const SAM = member('sam', 'Member', '2025-06-01T00:00:00Z');
const PRIYA = member('priya', 'Viewer', '2026-02-01T00:00:00Z');
const MORGAN = {
  id: 'morgan', email: 'morgan@example.com', role: 'Member', createdAt: '2026-10-12T00:00:00Z',
} as const;
const FAILURE = { code: 'network.unavailable' };
const CHANGED = { ok: false, error: { code: 'household.changed' } } as const;

/**
 * Builds a state with the lists loaded.
 *
 * @param overrides - Fields to set.
 * @returns The state.
 */
const loaded = (overrides: Partial<MembershipState> = {}): MembershipState => ({
  ...INITIAL_MEMBERSHIP,
  view: { status: 'loaded', members: [JANE, ALEX, SAM, PRIYA], invitations: [MORGAN] },
  ...overrides,
});

/**
 * Reads the loaded view of a state.
 *
 * @param state - The state.
 * @returns Its loaded view.
 */
const viewOf = (state: MembershipState) => (
  state.view as Extract<MembershipView, { status: 'loaded' }>
);

describe('membershipState — reading the lists', () => {
  it('joins the names, skipping a blank one', () => {
    expect(fullName(JANE)).toBe('jane Doe');
    expect(fullName({ firstName: 'Cher', lastName: '' })).toBe('Cher');
  });

  it('orders the members by role, then the longest-tenured first', () => {
    const newAdmin = member('new', 'Admin', '2026-09-01T00:00:00Z');
    expect(sortMembers([PRIYA, newAdmin, SAM, ALEX, JANE]).map(({ userId }) => userId))
      .toEqual(['jane', 'alex', 'new', 'sam', 'priya']);
  });

  it('keeps only the pending invitations, newest first, without their status', () => {
    const listed = [
      invitation('old', 'pending', '2026-01-01T00:00:00Z'),
      invitation('done', 'accepted', '2026-05-01T00:00:00Z'),
      invitation('new', 'pending', '2026-09-01T00:00:00Z'),
    ];
    expect(pendingOnly(listed)).toEqual([
      {
        id: 'new', email: 'new@example.com', role: 'Member', createdAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'old', email: 'old@example.com', role: 'Member', createdAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('lets the Owner and Admins manage members, nobody else', () => {
    expect(managesMembers('Owner')).toBe(true);
    expect(managesMembers('Admin')).toBe(true);
    expect(managesMembers('Member')).toBe(false);
    expect(managesMembers('Viewer')).toBe(false);
    expect(managesMembers(undefined)).toBe(false);
  });

  it('finds the signed-in user role once the list is loaded', () => {
    expect(selfRole(loaded().view, 'alex')).toBe('Admin');
    expect(selfRole(loaded().view, 'stranger')).toBeUndefined();
    expect(selfRole({ status: 'loading' }, 'alex')).toBeUndefined();
  });
});

describe('membershipState — loading', () => {
  it('sorts what loaded and keeps the pending invitations', () => {
    const next = afterLoad(INITIAL_MEMBERSHIP, {
      ok: true,
      members: [SAM, JANE],
      invitations: [invitation('x', 'revoked', '2026-01-01T00:00:00Z')],
    });
    expect(next.view).toEqual({ status: 'loaded', members: [JANE, SAM], invitations: [] });
  });

  it('keeps a failed load with its reason', () => {
    expect(afterLoad(INITIAL_MEMBERSHIP, { ok: false, error: FAILURE }).view)
      .toEqual({ status: 'failed', error: FAILURE });
  });

  it('reloads with no confirm open, keeping each panel failure', () => {
    const before = loaded({
      confirm: { kind: 'remove', userId: 'sam' },
      errors: { members: { code: 'household.changed' } },
    });
    expect(loading(before)).toEqual({
      ...before, view: { status: 'loading' }, confirm: undefined,
    });
  });
});

describe('membershipState — confirms and requests', () => {
  it('opens a confirm, dropping the members panel failure, and closes it', () => {
    const opened = confirmOpened(
      loaded({ errors: { members: FAILURE, invite: FAILURE } }),
      { kind: 'transfer', userId: 'sam' },
    );
    expect(opened.confirm).toEqual({ kind: 'transfer', userId: 'sam' });
    expect(opened.errors).toEqual({ members: undefined, invite: FAILURE });
    expect(confirmCancelled(opened).confirm).toBeUndefined();
  });

  it('marks a request out and drops only its own panel failure', () => {
    const before = loaded({ errors: { members: FAILURE, invitations: FAILURE, invite: FAILURE } });
    const revoking = started(before, { kind: 'revoke', invitationId: 'morgan' });
    expect(revoking.out).toEqual({ kind: 'revoke', invitationId: 'morgan' });
    expect(revoking.errors).toEqual({ members: FAILURE, invitations: undefined, invite: FAILURE });
    const inviting = started(before, { kind: 'invite', email: 'x@example.com', role: 'Viewer' });
    expect(inviting.errors.invite).toBeUndefined();
  });

  it('ignores an answer when nothing is out', () => {
    const state = loaded();
    expect(afterAction(state, { ok: true })).toBe(state);
  });

  it('puts a failure in the request panel and keeps the lists and confirm', () => {
    const state = started(
      loaded({ confirm: { kind: 'remove', userId: 'sam' } }),
      { kind: 'remove', userId: 'sam' },
    );
    const next = afterAction(state, { ok: false, error: FAILURE });
    expect(next.out).toBeUndefined();
    expect(next.errors.members).toEqual(FAILURE);
    expect(next.confirm).toEqual({ kind: 'remove', userId: 'sam' });
    expect(next.view).toBe(state.view);
  });
});

describe('membershipState — what a success changes', () => {
  it('changes a role and re-sorts', () => {
    const changing = started(loaded(), { kind: 'role', userId: 'priya', role: 'Admin' });
    const next = afterAction(changing, { ok: true });
    expect(viewOf(next).members.map(({ userId, role }) => `${userId}:${role}`))
      .toEqual(['jane:Owner', 'alex:Admin', 'priya:Admin', 'sam:Member']);
    expect(next.out).toBeUndefined();
    // Only an invite empties the invite form; a half-typed email survives.
    expect(next.inviteForm).toBe(0);
  });

  it('drops a removed member and closes the confirm', () => {
    const state = started(
      loaded({ confirm: { kind: 'remove', userId: 'sam' } }),
      { kind: 'remove', userId: 'sam' },
    );
    const next = afterAction(state, { ok: true });
    expect(viewOf(next).members.map(({ userId }) => userId)).toEqual(['jane', 'alex', 'priya']);
    expect(next.confirm).toBeUndefined();
  });

  it('hands ownership over: the new Owner first, the old one an Admin', () => {
    const next = afterAction(started(loaded(), { kind: 'transfer', userId: 'sam' }), { ok: true });
    expect(viewOf(next).members.map(({ userId, role }) => `${userId}:${role}`))
      .toEqual(['sam:Owner', 'jane:Admin', 'alex:Admin', 'priya:Viewer']);
  });

  it('drops the revoked invitation alone', () => {
    const lee = { ...MORGAN, id: 'lee', email: 'lee@example.com' };
    const state = loaded({ view: { ...viewOf(loaded()), invitations: [lee, MORGAN] } });
    const revoking = started(state, { kind: 'revoke', invitationId: 'morgan' });
    const next = afterAction(revoking, { ok: true });
    expect(viewOf(next).invitations).toEqual([lee]);
  });

  it('adds a sent invitation first with the typed email, and empties the form', () => {
    const state = started(loaded(), { kind: 'invite', email: 'lee@example.com', role: 'Viewer' });
    const next = afterAction(state, {
      ok: true, invitation: { id: 'lee', role: 'Viewer', createdAt: '2026-10-15T00:00:00Z' },
    });
    expect(viewOf(next).invitations).toEqual([
      {
        id: 'lee', email: 'lee@example.com', role: 'Viewer', createdAt: '2026-10-15T00:00:00Z',
      },
      MORGAN,
    ]);
    expect(next.inviteForm).toBe(1);
  });

  it('leaves the lists alone when they are not loaded, or an invite has no invitation', () => {
    const notLoaded = started(INITIAL_MEMBERSHIP, { kind: 'remove', userId: 'sam' });
    expect(afterAction(notLoaded, { ok: true }).view).toEqual({ status: 'loading' });
    const invite = started(loaded(), { kind: 'invite', email: 'lee@example.com', role: 'Viewer' });
    expect(viewOf(afterAction(invite, { ok: true })).invitations).toEqual([MORGAN]);
  });

  it('reloads only when the membership changed under the request', () => {
    expect(needsReload(CHANGED)).toBe(true);
    expect(needsReload({ ok: false, error: FAILURE })).toBe(false);
    expect(needsReload({ ok: true })).toBe(false);
  });
});
