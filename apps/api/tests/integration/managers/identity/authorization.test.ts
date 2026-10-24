import { captureLogs } from '@financas/logging';
import type { Mock } from 'vitest';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, BEN_ID, fakeDeps, HOUSEHOLD, INVITATION, NOW, SESSION,
} from './fakes';

// The seam between IdentityManager and AuthorizationUtility, across every
// household-guarded use case (I1): each asks for its own permission, and a
// refused caller stops the use case before any other dependency is touched.

const ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const CONTEXT = { correlationId: '0199c5a0-0000-7000-8000-0000000000cc', actor: ACTOR };
const NOT_FOUND = { apiError: { status: 404, code: 'household.not_found' } };
const FORBIDDEN = { apiError: { status: 403, code: 'auth.forbidden' } };

type Manager = ReturnType<typeof createIdentityManager>;

type GuardedUseCase = [string, string, (manager: Manager) => Promise<unknown>];

const INVITE = { email: 'ben@example.com', role: 'Member' as const };

const GUARDED: readonly GuardedUseCase[] = [
  ['deleteHousehold', 'household.delete',
    (manager) => manager.deleteHousehold(CONTEXT, HOUSEHOLD.id)],
  ['listMembers', 'household.view',
    (manager) => manager.listMembers(CONTEXT, HOUSEHOLD.id)],
  ['removeMember', 'members.manage',
    (manager) => manager.removeMember(CONTEXT, HOUSEHOLD.id, BEN_ID)],
  ['changeMemberRole', 'members.manage',
    (manager) => manager.changeMemberRole(CONTEXT, HOUSEHOLD.id, BEN_ID, 'Admin')],
  ['transferOwnership', 'household.transferOwnership',
    (manager) => manager.transferOwnership(CONTEXT, HOUSEHOLD.id, BEN_ID)],
  ['inviteUser', 'members.manage',
    (manager) => manager.inviteUser(CONTEXT, HOUSEHOLD.id, INVITE)],
  ['listHouseholdInvitations', 'members.manage',
    (manager) => manager.listHouseholdInvitations(CONTEXT, HOUSEHOLD.id)],
  ['revokeInvitation', 'members.manage',
    (manager) => manager.revokeInvitation(CONTEXT, HOUSEHOLD.id, INVITATION.id)],
];

/**
 * Every mocked call made to the dependencies a guarded use case may reach
 * after its permission check — Accessors, the bus and NotificationEngine.
 *
 * @param fakes - The mocks from `fakeDeps`.
 * @returns The names of the mocks that were called.
 */
const touchedBeyondAuthorization = (fakes: ReturnType<typeof fakeDeps>): string[] => {
  const groups = {
    users: fakes.users,
    sessions: fakes.sessions,
    households: fakes.households,
    invitations: fakes.invitations,
    bus: fakes.bus,
    notifications: fakes.notifications,
  };
  return Object.entries(groups).flatMap(([group, mocks]) => Object.entries(mocks)
    .filter(([, mock]) => (mock as Mock).mock.calls.length > 0)
    .map(([name]) => `${group}.${name}`));
};

describe('IdentityManager ↔ AuthorizationUtility seam (I1, OQ-117)', () => {
  it.each(GUARDED)('%s asks for %s on the caller and household', async (_name, action, run) => {
    const fakes = fakeDeps();
    // Ben is a plain member to act on; the invitee (Ana's own email) is not one yet.
    (fakes.households.findMembership as Mock).mockImplementation(
      async (_householdId: string, userId: string) => (
        userId === BEN_ID ? { role: 'Member', joinedAt: NOW } : undefined
      ),
    );
    // The logger on, so the use case logs as it does outside tests.
    captureLogs(onTestFinished);

    await run(createIdentityManager(fakes.deps));

    expect(fakes.authorization.authorize).toHaveBeenCalledOnce();
    expect(fakes.authorization.authorize).toHaveBeenCalledWith(ANA.id, HOUSEHOLD.id, { action });
  });

  describe.each([
    ['a non-member', { outcome: 'not_member' }, NOT_FOUND],
    ['a member without the role', { outcome: 'forbidden' }, FORBIDDEN],
  ])('refusing %s', (_who, outcome, answer) => {
    it.each(GUARDED)('%s answers before touching anything, logging nothing', async (
      _name,
      _action,
      run,
    ) => {
      const fakes = fakeDeps();
      fakes.authorization.authorize.mockResolvedValueOnce(outcome);
      const logs = captureLogs(onTestFinished);

      await expect(run(createIdentityManager(fakes.deps))).rejects.toMatchObject(answer);

      expect(touchedBeyondAuthorization(fakes)).toEqual([]);
      expect(logs.events).toEqual([]);
    });
  });
});
