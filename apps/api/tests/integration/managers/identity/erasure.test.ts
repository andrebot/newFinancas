import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, BEN_ID, fakeDeps, HOUSEHOLD, NOW, SESSION,
} from './fakes';
import { expectAudited } from '../audit';

// Delete User (uc-12, FR-1.17/FR-1.18, OQ-240) — the widest fan-out in
// IdentityManager: each household departed (succession or dissolution), then
// one erasure everywhere with the user row last. No rejection path exists.

const ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const CONTEXT = { correlationId: 'c1', actor: ACTOR };
const OWNER = { role: 'Owner', joinedAt: NOW };
const MEMBER_ROLE = { role: 'Member', joinedAt: NOW };
const SECOND = {
  ...HOUSEHOLD, id: '0199c5a0-0000-7000-8000-0000000000b2',
};
const THIRD = {
  ...HOUSEHOLD, id: '0199c5a0-0000-7000-8000-0000000000b3',
};

/** The erasure's Accessors, in the order the foreign keys need. */
const ERASURE_ORDER = [
  'accountTransactions', 'cardTransactions', 'goals', 'budgets', 'accounts', 'indexRates',
  'invitations',
] as const;

describe('IdentityManager — Delete User (uc-12, FR-1.17/FR-1.18)', () => {
  it('departs every household, then erases everywhere and deletes the user, audited', async () => {
    const {
      deps, households, erasure, inErasure,
    } = fakeDeps();
    households.listForUser.mockResolvedValueOnce([HOUSEHOLD, SECOND, THIRD]);
    // Casa: Owner with a successor; the second: a Member; the third: Owner, alone.
    households.findMembership
      .mockResolvedValueOnce(OWNER)
      .mockResolvedValueOnce(MEMBER_ROLE)
      .mockResolvedValueOnce(OWNER);
    households.findSuccessor
      .mockResolvedValueOnce({ userId: BEN_ID, role: 'Admin' })
      .mockResolvedValueOnce(undefined);
    const logs = captureLogs(onTestFinished);

    await createIdentityManager(deps).deleteUser(CONTEXT);

    expect(households.swapOwner).toHaveBeenCalledWith(HOUSEHOLD.id, ANA.id, BEN_ID);
    expect(households.removeMember).toHaveBeenCalledWith(HOUSEHOLD.id, ANA.id);
    expect(households.removeMember).toHaveBeenCalledWith(SECOND.id, ANA.id);
    expect(households.dissolve).toHaveBeenCalledWith(THIRD.id, ANA.id);
    expect(inErasure).toHaveBeenCalledOnce();
    const order = ERASURE_ORDER.map((name) => {
      expect(erasure[name].forgetUser).toHaveBeenCalledWith({ userId: ANA.id });
      return erasure[name].forgetUser.mock.invocationCallOrder[0]!;
    });
    expect(order).toEqual([...order].sort((first, second) => first - second));
    expect(erasure.users.delete).toHaveBeenCalledWith(ANA.id);
    expect(erasure.users.delete.mock.invocationCallOrder[0]).toBeGreaterThan(order.at(-1)!);
    expect(households.dissolve.mock.invocationCallOrder[0]).toBeLessThan(order[0]!);
    expectAudited(logs.events, {
      action: 'DeleteUser',
      actorId: ANA.id,
      entityType: 'User',
      entityId: ANA.id,
      householdId: null,
    });
    expectAudited(logs.events, {
      action: 'DissolveHousehold',
      actorId: ANA.id,
      entityType: 'Household',
      entityId: THIRD.id,
      householdId: THIRD.id,
    });
  });

  it('succeeds unconditionally for a user in no household — nothing refuses it', async () => {
    const { deps, households, erasure } = fakeDeps();
    households.listForUser.mockResolvedValueOnce([]);

    await expect(createIdentityManager(deps).deleteUser(CONTEXT)).resolves.toBeUndefined();

    expect(households.findMembership).not.toHaveBeenCalled();
    expect(erasure.users.delete).toHaveBeenCalledWith(ANA.id);
  });

  it('finishes a run cut short: the user already deleted is fine', async () => {
    const { deps, households, erasure } = fakeDeps();
    households.listForUser.mockResolvedValueOnce([]);
    erasure.users.delete.mockResolvedValueOnce('not_found');

    await expect(createIdentityManager(deps).deleteUser(CONTEXT)).resolves.toBeUndefined();
  });

  it('rolls the erasure back when a row still names the user, unaudited', async () => {
    const { deps, erasure } = fakeDeps();
    erasure.users.delete.mockResolvedValueOnce('still_referenced');
    const logs = captureLogs(onTestFinished);

    await expect(createIdentityManager(deps).deleteUser(CONTEXT))
      .rejects.toThrow('A row still names the user after the erasure');
    expect(logs.events.filter((event) => event.message === 'DeleteUser')).toEqual([]);
  });

  it('erases nothing while a household keeps changing (409)', async () => {
    const { deps, households, inErasure } = fakeDeps();
    households.removeMember.mockResolvedValue('stale');

    await expect(createIdentityManager(deps).deleteUser(CONTEXT))
      .rejects.toMatchObject({ domainError: { code: 'household.changed' } });
    expect(inErasure).not.toHaveBeenCalled();
  });
});
