import { captureLogs } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, BEN_ID, fakeDeps, HOUSEHOLD, NOW, SESSION,
} from './fakes';
import { expectAudited } from '../audit';

const ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const CONTEXT = { correlationId: 'c1', actor: ACTOR };
const HOME = HOUSEHOLD.id;
const CHANGED = { apiError: { status: 409, code: 'household.changed' } };
const FORBIDDEN = { apiError: { status: 403, code: 'auth.forbidden' } };
const OWNER = { role: 'Owner', joinedAt: NOW };

describe('IdentityManager — Remove Member (uc-07, FR-1.11)', () => {
  it('removes a member for an Owner/Admin, audited', async () => {
    const { deps, households, authorization } = fakeDeps();
    const logs = captureLogs();

    await createIdentityManager(deps).removeMember(CONTEXT, HOME, BEN_ID);
    logs.stop();

    expect(authorization.authorize)
      .toHaveBeenCalledWith(ANA.id, HOME, { action: 'members.manage' });
    expect(households.removeMember).toHaveBeenCalledWith(HOME, BEN_ID);
    expectAudited(logs.events, {
      action: 'RemoveMember',
      actorId: ANA.id,
      entityType: 'User',
      entityId: BEN_ID,
      householdId: HOME,
    });
  });

  it('never removes the Owner (OQ-111)', async () => {
    const { deps, households } = fakeDeps();
    households.findMembership.mockResolvedValueOnce(OWNER);

    await expect(createIdentityManager(deps).removeMember(CONTEXT, HOME, BEN_ID))
      .rejects.toMatchObject(FORBIDDEN);
    expect(households.removeMember).not.toHaveBeenCalled();
  });

  it('answers 404 for someone who is not a member, 409 when it changed meanwhile', async () => {
    const { deps, households } = fakeDeps();
    const identity = createIdentityManager(deps);
    households.findMembership.mockResolvedValueOnce(undefined);

    await expect(identity.removeMember(CONTEXT, HOME, BEN_ID))
      .rejects.toMatchObject({ apiError: { status: 404, code: 'household.member_not_found' } });

    households.removeMember.mockResolvedValueOnce('stale');
    await expect(identity.removeMember(CONTEXT, HOME, BEN_ID)).rejects.toMatchObject(CHANGED);
  });
});

describe('IdentityManager — Leave Household (uc-08, FR-1.18, OQ-107)', () => {
  /**
   * Leaves Ana's household through a fresh Manager.
   *
   * @param deps - The mocked tier below.
   * @returns The leave's promise.
   */
  const leave = (deps: ReturnType<typeof fakeDeps>['deps']) => (
    createIdentityManager(deps).removeMember(CONTEXT, HOME, ANA.id)
  );

  it('lets a member leave without any permission check', async () => {
    const { deps, households, authorization } = fakeDeps();
    const logs = captureLogs();

    await leave(deps);
    logs.stop();

    expect(authorization.authorize).not.toHaveBeenCalled();
    expect(households.removeMember).toHaveBeenCalledWith(HOME, ANA.id);
    expectAudited(logs.events, {
      action: 'LeaveHousehold',
      actorId: ANA.id,
      entityType: 'Household',
      entityId: HOME,
      householdId: HOME,
    });
  });

  it('hands the household to the successor before the Owner leaves', async () => {
    const { deps, households } = fakeDeps();
    households.findMembership.mockResolvedValueOnce(OWNER);
    const logs = captureLogs();

    await leave(deps);
    logs.stop();

    expect(households.findSuccessor).toHaveBeenCalledWith(HOME, ANA.id);
    expect(households.swapOwner).toHaveBeenCalledWith(HOME, ANA.id, BEN_ID);
    expect(households.removeMember).toHaveBeenCalledWith(HOME, ANA.id);
    expect(households.dissolve).not.toHaveBeenCalled();
    expectAudited(logs.events, {
      action: 'LeaveHousehold',
      actorId: ANA.id,
      entityType: 'Household',
      entityId: HOME,
      householdId: HOME,
    });
  });

  it('dissolves the household when the Owner was the last member', async () => {
    const { deps, households } = fakeDeps();
    households.findMembership.mockResolvedValueOnce(OWNER);
    households.findSuccessor.mockResolvedValueOnce(undefined);
    const logs = captureLogs();

    await leave(deps);
    logs.stop();

    expect(households.dissolve).toHaveBeenCalledWith(HOME, ANA.id);
    expect(households.removeMember).not.toHaveBeenCalled();
    expectAudited(logs.events, {
      action: 'DissolveHousehold',
      actorId: ANA.id,
      entityType: 'Household',
      entityId: HOME,
      householdId: HOME,
    });
  });

  it('decides again from fresh facts when someone joined just before dissolving', async () => {
    const { deps, households } = fakeDeps();
    households.findMembership.mockResolvedValue(OWNER);
    households.findSuccessor.mockResolvedValueOnce(undefined);
    households.dissolve.mockResolvedValueOnce('stale');

    await leave(deps);

    expect(households.findSuccessor).toHaveBeenCalledTimes(2);
    expect(households.swapOwner).toHaveBeenCalledWith(HOME, ANA.id, BEN_ID);
  });

  it('retries a stale swap, and gives up with 409 after three tries', async () => {
    const { deps, households } = fakeDeps();
    households.findMembership.mockResolvedValue(OWNER);
    households.swapOwner.mockResolvedValue('stale');

    await expect(leave(deps)).rejects.toMatchObject(CHANGED);
    expect(households.swapOwner).toHaveBeenCalledTimes(3);
  });

  it('retries a member\'s stale removal (e.g. made Owner meanwhile)', async () => {
    const { deps, households } = fakeDeps();
    households.removeMember.mockResolvedValueOnce('stale');

    await leave(deps);

    expect(households.removeMember).toHaveBeenCalledTimes(2);
  });

  it('answers 404 to someone who is not a member', async () => {
    const { deps, households } = fakeDeps();
    households.findMembership.mockResolvedValueOnce(undefined);

    await expect(leave(deps))
      .rejects.toMatchObject({ apiError: { status: 404, code: 'household.not_found' } });
  });
});

describe('IdentityManager — Change Member Role (uc-09, FR-1.12)', () => {
  it('sets an Admin/Member/Viewer role, audited', async () => {
    const { deps, households } = fakeDeps();
    const logs = captureLogs();

    await createIdentityManager(deps).changeMemberRole(CONTEXT, HOME, BEN_ID, 'Admin');
    logs.stop();

    expect(households.updateRole).toHaveBeenCalledWith(HOME, BEN_ID, 'Admin');
    expectAudited(logs.events, {
      action: 'ChangeMemberRole',
      actorId: ANA.id,
      entityType: 'User',
      entityId: BEN_ID,
      householdId: HOME,
    });
  });

  it('never touches the Owner\'s role, and answers 409 when it changed meanwhile', async () => {
    const { deps, households } = fakeDeps();
    const identity = createIdentityManager(deps);
    households.findMembership.mockResolvedValueOnce(OWNER);

    await expect(identity.changeMemberRole(CONTEXT, HOME, BEN_ID, 'Viewer'))
      .rejects.toMatchObject(FORBIDDEN);

    households.updateRole.mockResolvedValueOnce('stale');
    await expect(identity.changeMemberRole(CONTEXT, HOME, BEN_ID, 'Viewer'))
      .rejects.toMatchObject(CHANGED);
  });
});

describe('IdentityManager — Transfer Ownership (uc-10, FR-1.20)', () => {
  it('swaps the Owner role to the target; the caller stays as Admin', async () => {
    const { deps, households, authorization } = fakeDeps();
    const logs = captureLogs();

    await createIdentityManager(deps).transferOwnership(CONTEXT, HOME, BEN_ID);
    logs.stop();

    expect(authorization.authorize)
      .toHaveBeenCalledWith(ANA.id, HOME, { action: 'household.transferOwnership' });
    expect(households.swapOwner).toHaveBeenCalledWith(HOME, ANA.id, BEN_ID);
    expectAudited(logs.events, {
      action: 'TransferOwnership',
      actorId: ANA.id,
      entityType: 'User',
      entityId: BEN_ID,
      householdId: HOME,
    });
  });

  it('does nothing when transferring to oneself', async () => {
    const { deps, households } = fakeDeps();

    await createIdentityManager(deps).transferOwnership(CONTEXT, HOME, ANA.id);

    expect(households.swapOwner).not.toHaveBeenCalled();
  });

  it('answers 403 to a non-Owner, 404 for a non-member target, 409 when it changed', async () => {
    const { deps, households, authorization } = fakeDeps();
    const identity = createIdentityManager(deps);

    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });
    await expect(identity.transferOwnership(CONTEXT, HOME, BEN_ID))
      .rejects.toMatchObject(FORBIDDEN);

    households.findMembership.mockResolvedValueOnce(undefined);
    await expect(identity.transferOwnership(CONTEXT, HOME, BEN_ID))
      .rejects.toMatchObject({ apiError: { status: 404, code: 'household.member_not_found' } });

    households.swapOwner.mockResolvedValueOnce('stale');
    await expect(identity.transferOwnership(CONTEXT, HOME, BEN_ID)).rejects.toMatchObject(CHANGED);
  });
});
