import { captureLogs } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, blankName, fakeDeps, HOUSEHOLD, RECEIVED, SESSION,
} from './fakes';
import { expectAudited } from './audit';

const ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const CONTEXT = { correlationId: 'c1', actor: ACTOR };
const GONE = { apiError: { status: 401, code: 'auth.unauthenticated' } };

describe('IdentityManager — View / Edit User (uc-13, FR-1.21)', () => {
  it('returns the caller\'s account, 401 when it is gone', async () => {
    const { deps, users } = fakeDeps();
    const identity = createIdentityManager(deps);

    await expect(identity.getProfile(CONTEXT)).resolves.toBe(ANA);
    expect(users.findById).toHaveBeenCalledWith(ANA.id);

    users.findById.mockResolvedValueOnce(undefined);
    await expect(identity.getProfile(CONTEXT)).rejects.toMatchObject(GONE);
  });

  it('changes only what was sent — names trimmed, preferences flattened — and audits', async () => {
    const { deps, users } = fakeDeps();
    const logs = captureLogs();

    await createIdentityManager(deps)
      .editProfile(CONTEXT, {
        firstName: ' Ana Paula ', lastName: ' Lima ', preferences: { theme: 'light' },
      });
    logs.stop();

    expect(users.update).toHaveBeenCalledWith(ANA.id, {
      firstName: 'Ana Paula', lastName: 'Lima', theme: 'light',
    });
    expectAudited(logs.events, {
      action: 'EditUser', actorId: ANA.id, entityType: 'User', entityId: ANA.id, householdId: null,
    });
  });

  it('refuses a blank name with 422 validation.failed, changing nothing (OQ-165)', async () => {
    const { deps, users } = fakeDeps();

    await expect(createIdentityManager(deps).editProfile(CONTEXT, { lastName: '  ' }))
      .rejects.toMatchObject(blankName('lastName'));
    expect(users.update).not.toHaveBeenCalled();
  });

  it('treats an empty edit as a read, and answers 401 when the account is gone', async () => {
    const { deps, users } = fakeDeps();
    const identity = createIdentityManager(deps);

    await expect(identity.editProfile(CONTEXT, { preferences: {} })).resolves.toBe(ANA);
    expect(users.update).not.toHaveBeenCalled();

    users.update.mockResolvedValueOnce(undefined);
    await expect(identity.editProfile(CONTEXT, { lastName: 'Lima' })).rejects.toMatchObject(GONE);
  });
});

describe('IdentityManager — List My Households (uc-21, FR-1.8)', () => {
  it('lists the caller\'s households with their role, and invitations with names', async () => {
    const { deps, households, invitations } = fakeDeps();
    const identity = createIdentityManager(deps);

    await expect(identity.listMyHouseholds(CONTEXT)).resolves.toEqual([HOUSEHOLD]);
    await expect(identity.listMyInvitations(CONTEXT)).resolves.toEqual([RECEIVED]);
    expect(households.listForUser).toHaveBeenCalledWith(ANA.id);
    expect(invitations.listPendingForUser).toHaveBeenCalledWith(ANA.id);
  });
});
