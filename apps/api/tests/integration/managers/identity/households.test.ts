import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, blankName, fakeDeps, HOUSEHOLD, MEMBER, NOW, SESSION,
} from './fakes';
import { expectAudited } from '../audit';

const ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const CORRELATION_ID = '0199c5a0-0000-7000-8000-0000000000cc';
const CONTEXT = { correlationId: CORRELATION_ID, actor: ACTOR };
const NOT_FOUND = { domainError: { code: 'household.not_found' } };
const FORBIDDEN = { domainError: { code: 'auth.forbidden' } };

describe('IdentityManager — Create Household (uc-01, FR-1.4)', () => {
  it('makes the caller Owner, announces it in their language, audits', async () => {
    const { deps, households, bus } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const created = await createIdentityManager(deps).createHousehold(CONTEXT, 'Casa');

    expect(households.insert).toHaveBeenCalledWith('Casa', ANA.id);
    expect(created).toEqual({
      id: HOUSEHOLD.id, name: 'Casa', createdAt: NOW, role: 'Owner',
    });
    expect(bus.publish).toHaveBeenCalledWith(
      'household.created',
      { householdId: HOUSEHOLD.id, createdByUserId: ANA.id, language: 'pt-BR' },
      CORRELATION_ID,
    );
    expectAudited(logs.events, {
      action: 'CreateHousehold',
      actorId: ANA.id,
      entityType: 'Household',
      entityId: HOUSEHOLD.id,
      householdId: HOUSEHOLD.id,
    });
  });

  it('trims the name before storing it', async () => {
    const { deps, households } = fakeDeps();

    await createIdentityManager(deps).createHousehold(CONTEXT, '  Casa ');

    expect(households.insert).toHaveBeenCalledWith('Casa', ANA.id);
  });

  it('refuses a blank name with 422 validation.failed, creating nothing (OQ-165)', async () => {
    const { deps, households, bus } = fakeDeps();

    await expect(createIdentityManager(deps).createHousehold(CONTEXT, '   '))
      .rejects.toMatchObject(blankName('name'));
    expect(households.insert).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('refuses with auth.unauthenticated when the creator\'s account is gone', async () => {
    const { deps, users, households } = fakeDeps();
    users.findById.mockResolvedValueOnce(undefined);

    await expect(createIdentityManager(deps).createHousehold(CONTEXT, 'Casa'))
      .rejects.toMatchObject({ domainError: { code: 'auth.unauthenticated' } });
    expect(households.insert).not.toHaveBeenCalled();
  });
});

describe('IdentityManager — households', () => {
  it('gets one of the caller\'s households; anyone else\'s is 404', async () => {
    const { deps } = fakeDeps();
    const identity = createIdentityManager(deps);

    await expect(identity.getHousehold(CONTEXT, HOUSEHOLD.id)).resolves.toEqual(HOUSEHOLD);
    await expect(identity.getHousehold(CONTEXT, 'someone-elses')).rejects.toMatchObject(NOT_FOUND);
  });

  it('deletes a household for its Owner (uc-02), audited', async () => {
    const { deps, households, authorization } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createIdentityManager(deps).deleteHousehold(CONTEXT, HOUSEHOLD.id);

    expect(authorization.authorize)
      .toHaveBeenCalledWith(ANA.id, HOUSEHOLD.id, { action: 'household.delete' });
    expect(households.delete).toHaveBeenCalledWith(HOUSEHOLD.id);
    expectAudited(logs.events, {
      action: 'DeleteHousehold',
      actorId: ANA.id,
      entityType: 'Household',
      entityId: HOUSEHOLD.id,
      householdId: HOUSEHOLD.id,
    });
  });

  it.each([
    ['a non-member', { outcome: 'not_member' }, NOT_FOUND],
    ['a member without the role', { outcome: 'forbidden' }, FORBIDDEN],
  ])('refuses %s before touching anything', async (_who, outcome, answer) => {
    const { deps, households, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce(outcome);

    await expect(createIdentityManager(deps).deleteHousehold(CONTEXT, HOUSEHOLD.id))
      .rejects.toMatchObject(answer);
    expect(households.delete).not.toHaveBeenCalled();
  });

  it('answers 404 when the household vanished before the delete', async () => {
    const { deps, households } = fakeDeps();
    households.delete.mockResolvedValueOnce(false);

    await expect(createIdentityManager(deps).deleteHousehold(CONTEXT, HOUSEHOLD.id))
      .rejects.toMatchObject(NOT_FOUND);
  });

  it('lists the members for any member', async () => {
    const { deps, authorization } = fakeDeps();

    await expect(createIdentityManager(deps).listMembers(CONTEXT, HOUSEHOLD.id))
      .resolves.toEqual([MEMBER]);
    expect(authorization.authorize)
      .toHaveBeenCalledWith(ANA.id, HOUSEHOLD.id, { action: 'household.view' });
  });
});
