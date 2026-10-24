import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished, vi,
} from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, BEN_ID, fakeDeps, HOUSEHOLD, INVITATION, NOW, SESSION,
} from './fakes';
import { expectAudited } from '../audit';

const HOME = HOUSEHOLD.id;
const ANA_ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const ANA_CONTEXT = { correlationId: 'c1', actor: ANA_ACTOR };
const BEN_CONTEXT = {
  correlationId: 'c1', actor: { userId: BEN_ID, sessionId: 's2', systemRole: 'USER' as const },
};
// The fakes type users as Ana's literal shape; Ben is the same kind of record.
const BEN = { ...ANA, id: BEN_ID, email: 'ben@example.com' } as unknown as typeof ANA;
const REQUEST = { email: ' ben@example.com ', role: 'Member' as const };
const NOT_FOUND = { domainError: { code: 'invitation.not_found' } };
const NOT_PENDING = { domainError: { code: 'invitation.not_pending' } };

describe('IdentityManager — Invite User (uc-03, FR-1.5/1.19)', () => {
  it('invites a registered user, tells them in the app, audits', async () => {
    const {
      deps, users, households, invitations, notifications, authorization,
    } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(BEN);
    households.findMembership.mockResolvedValueOnce(undefined);
    const logs = captureLogs(onTestFinished);

    const invitation = await createIdentityManager(deps).inviteUser(ANA_CONTEXT, HOME, REQUEST);

    expect(authorization.authorize)
      .toHaveBeenCalledWith(ANA.id, HOME, { action: 'members.manage' });
    expect(users.findByEmail).toHaveBeenCalledWith('ben@example.com');
    expect(invitations.insert).toHaveBeenCalledWith({
      householdId: HOME, invitedUserId: BEN_ID, invitedByUserId: ANA.id, role: 'Member',
    });
    expect(invitation).toBe(INVITATION);
    expect(notifications.notify).toHaveBeenCalledWith(
      'invitation.received',
      { userId: BEN_ID },
      {
        invitationId: INVITATION.id,
        householdId: INVITATION.householdId,
        inviterUserId: ANA.id,
        role: 'Member',
      },
    );
    expectAudited(logs.events, {
      action: 'InviteUser',
      actorId: ANA.id,
      entityType: 'Invitation',
      entityId: INVITATION.id,
      householdId: HOME,
    });
  });

  it('answers 404 for an email with no account', async () => {
    const { deps, users, invitations } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(undefined);

    await expect(createIdentityManager(deps).inviteUser(ANA_CONTEXT, HOME, REQUEST))
      .rejects.toMatchObject({
        domainError: { code: 'invitation.invitee_not_registered' },
      });
    expect(invitations.insert).not.toHaveBeenCalled();
  });

  it('refuses a member and an already-invited person (OQ-109)', async () => {
    const { deps, households, invitations } = fakeDeps();
    const identity = createIdentityManager(deps);

    await expect(identity.inviteUser(ANA_CONTEXT, HOME, REQUEST))
      .rejects.toMatchObject({ domainError: { code: 'invitation.already_member' } });

    households.findMembership.mockResolvedValueOnce(undefined);
    invitations.findPending.mockResolvedValueOnce(INVITATION);
    await expect(identity.inviteUser(ANA_CONTEXT, HOME, REQUEST))
      .rejects.toMatchObject({ domainError: { code: 'invitation.already_pending' } });
  });

  it.each([
    ['already_pending', 'invitation.already_pending'],
    ['invitee_missing', 'invitation.invitee_not_registered'],
  ])('maps a %s insert (lost race) to %s', async (reason, code) => {
    const { deps, households, invitations } = fakeDeps();
    households.findMembership.mockResolvedValueOnce(undefined);
    invitations.insert.mockResolvedValueOnce({ ok: false, reason });

    await expect(createIdentityManager(deps).inviteUser(ANA_CONTEXT, HOME, REQUEST))
      .rejects.toMatchObject({ domainError: { code } });
  });

  it('keeps the invitation when the notification fails, logging it', async () => {
    const { deps, households, notifications } = fakeDeps();
    households.findMembership.mockResolvedValueOnce(undefined);
    notifications.notify.mockRejectedValueOnce(new Error('inbox down'));
    const logs = captureLogs(onTestFinished);

    await expect(createIdentityManager(deps).inviteUser(ANA_CONTEXT, HOME, REQUEST))
      .resolves.toBe(INVITATION);
    await vi.waitFor(() => expect(logs.events)
      .toContainEqual(expect.objectContaining({ level: 'error', error: 'Error: inbox down' })));
  });

  it('lists the household\'s invitations for an Owner/Admin', async () => {
    const { deps, authorization } = fakeDeps();

    await expect(createIdentityManager(deps).listHouseholdInvitations(ANA_CONTEXT, HOME))
      .resolves.toEqual([INVITATION]);
    expect(authorization.authorize)
      .toHaveBeenCalledWith(ANA.id, HOME, { action: 'members.manage' });
  });
});

describe('IdentityManager — Revoke (uc-06)', () => {
  it('revokes a pending invitation of this household, audited', async () => {
    const { deps, invitations } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createIdentityManager(deps).revokeInvitation(ANA_CONTEXT, HOME, INVITATION.id);

    expect(invitations.resolve).toHaveBeenCalledWith(INVITATION.id, 'revoked', NOW);
    expectAudited(logs.events, {
      action: 'RevokeInvitation',
      actorId: ANA.id,
      entityType: 'Invitation',
      entityId: INVITATION.id,
      householdId: HOME,
    });
  });

  it('answers 404 for an unknown or foreign invitation, 409 once resolved', async () => {
    const { deps, invitations } = fakeDeps();
    const identity = createIdentityManager(deps);
    invitations.findById.mockResolvedValueOnce(undefined);

    await expect(identity.revokeInvitation(ANA_CONTEXT, HOME, 'no-such-invitation'))
      .rejects.toMatchObject(NOT_FOUND);

    invitations.findById.mockResolvedValueOnce({ ...INVITATION, householdId: 'elsewhere' });
    await expect(identity.revokeInvitation(ANA_CONTEXT, HOME, INVITATION.id))
      .rejects.toMatchObject(NOT_FOUND);

    invitations.resolve.mockResolvedValueOnce('stale');
    await expect(identity.revokeInvitation(ANA_CONTEXT, HOME, INVITATION.id))
      .rejects.toMatchObject(NOT_PENDING);
  });
});

describe('IdentityManager — Accept / Decline (uc-04/05, FR-1.10)', () => {
  it('accepts: resolves first, then joins with the invited role', async () => {
    const { deps, invitations, households } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const joined = await createIdentityManager(deps).acceptInvitation(BEN_CONTEXT, INVITATION.id);

    expect(joined).toEqual({ householdId: INVITATION.householdId, role: 'Member' });
    expect(invitations.resolve).toHaveBeenCalledWith(INVITATION.id, 'accepted', NOW);
    expect(households.addMember).toHaveBeenCalledWith(INVITATION.householdId, BEN_ID, 'Member');
    expect(invitations.resolve.mock.invocationCallOrder[0]!)
      .toBeLessThan(households.addMember.mock.invocationCallOrder[0]!);
    expectAudited(logs.events, {
      action: 'AcceptInvitation',
      actorId: BEN_ID,
      entityType: 'Invitation',
      entityId: INVITATION.id,
      householdId: INVITATION.householdId,
    });
  });

  it('never adds a member when the invitation was revoked meanwhile', async () => {
    const { deps, invitations, households } = fakeDeps();
    invitations.resolve.mockResolvedValueOnce('stale');

    await expect(createIdentityManager(deps).acceptInvitation(BEN_CONTEXT, INVITATION.id))
      .rejects.toMatchObject(NOT_PENDING);
    expect(households.addMember).not.toHaveBeenCalled();
  });

  it('declines without creating a membership — logged, not audited (FR-7.1)', async () => {
    const { deps, invitations, households } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createIdentityManager(deps).declineInvitation(BEN_CONTEXT, INVITATION.id);

    expect(invitations.resolve).toHaveBeenCalledWith(INVITATION.id, 'declined', NOW);
    expect(households.addMember).not.toHaveBeenCalled();
    expect(logs.events.map((event) => event.level)).toEqual(['info']);
  });

  it.each(['acceptInvitation', 'declineInvitation'] as const)(
    '%s: someone else\'s or a missing invitation is 404',
    async (useCase) => {
      const { deps, invitations } = fakeDeps();
      const identity = createIdentityManager(deps);

      await expect(identity[useCase](ANA_CONTEXT, INVITATION.id)).rejects.toMatchObject(NOT_FOUND);
      invitations.findById.mockResolvedValueOnce(undefined);
      await expect(identity[useCase](BEN_CONTEXT, INVITATION.id)).rejects.toMatchObject(NOT_FOUND);
    },
  );
});
