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
// IdentityManager: each household departed (succession or dissolution) in one
// transaction with its erasure, then one erasure everywhere with the user row
// last, once no membership is left. No rejection path exists. The fake
// transaction only runs the work: a throw from it is what rolls the real one back.

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
const CHANGED = { domainError: { code: 'household.changed' } };

/** The erasure's Accessors, in the order the foreign keys need. */
const ERASURE_ORDER = [
  'accountTransactions', 'cardTransactions', 'goals', 'budgets', 'accounts', 'indexRates',
  'invitations',
] as const;

/**
 * Mocked dependencies for a user in the given households, and in none once they
 * departed (the final check inside the erasure's transaction).
 *
 * @param memberships - The households listed first.
 * @returns The mocks.
 */
const depsWith = (memberships: readonly (typeof HOUSEHOLD)[]) => {
  const fakes = fakeDeps();
  fakes.households.listForUser
    .mockResolvedValueOnce([...memberships])
    .mockResolvedValueOnce([]);
  return fakes;
};

describe('IdentityManager — Delete User (uc-12, FR-1.17/FR-1.18)', () => {
  it('departs every household with its erasure, then erases everywhere', async () => {
    const { deps, households, erasure } = depsWith([HOUSEHOLD, SECOND, THIRD]);
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
    ERASURE_ORDER.forEach((name) => {
      expect(erasure[name].forgetUser.mock.calls).toEqual([
        [{ userId: ANA.id, householdId: HOUSEHOLD.id }],
        [{ userId: ANA.id, householdId: SECOND.id }],
        [{ userId: ANA.id, householdId: THIRD.id }],
        [{ userId: ANA.id }],
      ]);
    });
    const lastRound = ERASURE_ORDER
      .map((name) => erasure[name].forgetUser.mock.invocationCallOrder[3]!);
    expect(lastRound).toEqual([...lastRound].sort((first, second) => first - second));
    expect(erasure.users.delete).toHaveBeenCalledWith(ANA.id);
    expect(erasure.users.delete.mock.invocationCallOrder[0]).toBeGreaterThan(lastRound.at(-1)!);
    expect(households.dissolve.mock.invocationCallOrder[0]).toBeLessThan(lastRound[0]!);
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

  it('erases each household before the step that ends the membership', async () => {
    const { deps, households, erasure } = depsWith([HOUSEHOLD]);

    await createIdentityManager(deps).deleteUser(CONTEXT);

    expect(erasure.accounts.forgetUser.mock.invocationCallOrder[0])
      .toBeLessThan(households.removeMember.mock.invocationCallOrder[0]!);
  });

  it('succeeds unconditionally for a user in no household — nothing refuses it', async () => {
    const { deps, households, erasure } = depsWith([]);

    await expect(createIdentityManager(deps).deleteUser(CONTEXT)).resolves.toBeUndefined();

    expect(households.findMembership).not.toHaveBeenCalled();
    expect(erasure.users.delete).toHaveBeenCalledWith(ANA.id);
  });

  it('finishes a run cut short: the user already deleted is fine', async () => {
    const { deps, erasure } = depsWith([]);
    erasure.users.delete.mockResolvedValueOnce('not_found');

    await expect(createIdentityManager(deps).deleteUser(CONTEXT)).resolves.toBeUndefined();
  });

  it('throws — rolling the erasure back — when a row still names the user, unaudited', async () => {
    const { deps, erasure } = depsWith([]);
    erasure.users.delete.mockResolvedValueOnce('still_referenced');
    const logs = captureLogs(onTestFinished);

    await expect(createIdentityManager(deps).deleteUser(CONTEXT))
      .rejects.toThrow('A row still names the user after the erasure');
    expect(logs.events.filter((event) => event.message === 'DeleteUser')).toEqual([]);
  });

  it('answers 409, deleting nothing, when the user joined a household meanwhile', async () => {
    const { deps, households, erasure } = fakeDeps();
    households.listForUser
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([HOUSEHOLD]);

    await expect(createIdentityManager(deps).deleteUser(CONTEXT)).rejects.toMatchObject(CHANGED);
    expect(erasure.accounts.forgetUser).not.toHaveBeenCalled();
    expect(erasure.users.delete).not.toHaveBeenCalled();
  });

  it('retries a stale departure from fresh facts, rolling each attempt back', async () => {
    const { deps, households, erasure } = depsWith([HOUSEHOLD]);
    households.removeMember.mockResolvedValueOnce('stale');

    await createIdentityManager(deps).deleteUser(CONTEXT);

    expect(households.removeMember).toHaveBeenCalledTimes(2);
    // Two attempts in Casa, then the erasure everywhere.
    expect(erasure.goals.forgetUser).toHaveBeenCalledTimes(3);
  });

  it('answers 409 while a household keeps changing, never deleting the user', async () => {
    const { deps, households, erasure } = depsWith([HOUSEHOLD]);
    households.removeMember.mockResolvedValue('stale');

    await expect(createIdentityManager(deps).deleteUser(CONTEXT)).rejects.toMatchObject(CHANGED);
    expect(erasure.users.delete).not.toHaveBeenCalled();
  });

  it('lets an unexpected failure through untouched', async () => {
    const { deps, households } = depsWith([HOUSEHOLD]);
    const failure = new Error('connection lost');
    households.removeMember.mockRejectedValueOnce(failure);

    await expect(createIdentityManager(deps).deleteUser(CONTEXT)).rejects.toBe(failure);
  });
});
