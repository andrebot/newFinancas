import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished, vi,
} from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import {
  ANA, fakeDeps, minutes, NOW, SESSION,
} from './fakes';
import { expectAudited } from '../audit';

const ACTOR = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };
const SIGNED_IN = { correlationId: 'c1', actor: ACTOR };
const PUBLIC = { correlationId: 'c1' };
const LONG = 'a-long-enough-password';
const TOO_SHORT = { apiError: { status: 422, code: 'password.too_short', params: { min: 12 } } };

describe('IdentityManager — Change Password (uc-19, FR-1.14)', () => {
  it('replaces the hash, ends every other session, audits', async () => {
    const { deps, users, sessions } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createIdentityManager(deps)
      .changePassword(SIGNED_IN, { currentPassword: 'old', newPassword: LONG });

    expect(users.updatePasswordHash).toHaveBeenCalledWith(ANA.id, `hash(${LONG})`);
    expect(sessions.deleteAllExceptCurrent).toHaveBeenCalledWith(ANA.id, SESSION.id);
    expectAudited(logs.events, {
      action: 'ChangePassword',
      actorId: ANA.id,
      entityType: 'User',
      entityId: ANA.id,
      householdId: null,
    });
  });

  it('answers 422 password.current_incorrect — not 401 — for a wrong current one', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyPassword.mockResolvedValueOnce(false);

    await expect(createIdentityManager(deps)
      .changePassword(SIGNED_IN, { currentPassword: 'wrong', newPassword: LONG }))
      .rejects.toMatchObject({ apiError: { status: 422, code: 'password.current_incorrect' } });
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('checks the new password\'s length first, and needs the account to exist', async () => {
    const { deps, users } = fakeDeps();
    const identity = createIdentityManager(deps);

    const tooShort = { currentPassword: 'old', newPassword: 'short' };
    await expect(identity.changePassword(SIGNED_IN, tooShort))
      .rejects.toMatchObject(TOO_SHORT);
    expect(users.findPasswordHash).not.toHaveBeenCalled();

    users.findPasswordHash.mockResolvedValueOnce(undefined);
    await expect(identity.changePassword(SIGNED_IN, { currentPassword: 'old', newPassword: LONG }))
      .rejects.toMatchObject({ apiError: { status: 401, code: 'auth.unauthenticated' } });
  });

  it('accepts a new password of exactly 12 characters, refuses 11', async () => {
    const { deps, users } = fakeDeps();
    const identity = createIdentityManager(deps);

    const withNew = (newPassword: string) => ({ currentPassword: 'old', newPassword });

    await expect(identity.changePassword(SIGNED_IN, withNew('x'.repeat(11))))
      .rejects.toMatchObject(TOO_SHORT);
    await identity.changePassword(SIGNED_IN, withNew('x'.repeat(12)));

    expect(users.updatePasswordHash).toHaveBeenCalledWith(ANA.id, `hash(${'x'.repeat(12)})`);
  });
});

describe('IdentityManager — Reset Password, step 1 (uc-18, OQ-115)', () => {
  it('answers before any work, then stores a 30-minute token and emails the link', async () => {
    const { deps, users, notifications } = fakeDeps();
    let releaseLookup: () => void = () => undefined;
    users.findByEmail.mockImplementationOnce(() => new Promise((resolve) => {
      releaseLookup = () => resolve(ANA);
    }));

    await createIdentityManager(deps).requestPasswordReset(PUBLIC, ' ana@example.com ');
    expect(users.storeResetToken).not.toHaveBeenCalled();
    releaseLookup();

    await vi.waitFor(() => expect(notifications.notify).toHaveBeenCalled());
    expect(users.findByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(users.storeResetToken).toHaveBeenCalledWith(ANA.id, 'refresh-hash', minutes(30));
    expect(notifications.notify).toHaveBeenCalledWith(
      'password.reset',
      { email: ANA.email, language: 'pt-BR' },
      { resetLink: 'http://web.test/reset-password?token=refresh-token', expiresInMinutes: 30 },
    );
  });

  it('does nothing for an unknown address, answering the same — and logs no failure', async () => {
    const { deps, users, notifications } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(undefined);
    const logs = captureLogs(onTestFinished);

    await expect(createIdentityManager(deps).requestPasswordReset(PUBLIC, 'nobody@example.com'))
      .resolves.toBeUndefined();

    await vi.waitFor(() => expect(users.findByEmail).toHaveBeenCalled());
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(users.storeResetToken).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(logs.events).toEqual([]);
  });

  it('logs a failure to send instead of returning it', async () => {
    const { deps, notifications } = fakeDeps();
    notifications.notify.mockRejectedValueOnce(new Error('provider down'));
    const logs = captureLogs(onTestFinished);

    await createIdentityManager(deps).requestPasswordReset(PUBLIC, 'ana@example.com');
    await vi.waitFor(() => expect(logs.events)
      .toContainEqual(expect.objectContaining({ level: 'error', error: 'Error: provider down' })));
  });
});

describe('IdentityManager — Reset Password, step 2 (uc-18)', () => {
  const CONFIRMATION = { token: 'from-link', newPassword: LONG };

  it('uses up the link, replaces the hash, ends all sessions, lifts the lock, audits', async () => {
    const { deps, users, sessions } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createIdentityManager(deps).confirmPasswordReset(PUBLIC, CONFIRMATION);

    expect(users.consumeResetToken).toHaveBeenCalledWith('hash(from-link)', NOW);
    expect(users.updatePasswordHash).toHaveBeenCalledWith(ANA.id, `hash(${LONG})`);
    expect(sessions.deleteAllForUser).toHaveBeenCalledWith(ANA.id);
    expect(users.clearLoginFailures).toHaveBeenCalledWith('ana@example.com');
    expectAudited(logs.events, {
      action: 'ResetPassword',
      actorId: ANA.id,
      entityType: 'User',
      entityId: ANA.id,
      householdId: null,
    });
  });

  it('checks the length before using up the link (OQ-103)', async () => {
    const { deps, users } = fakeDeps();

    await expect(createIdentityManager(deps)
      .confirmPasswordReset(PUBLIC, { ...CONFIRMATION, newPassword: 'short' }))
      .rejects.toMatchObject(TOO_SHORT);
    expect(users.consumeResetToken).not.toHaveBeenCalled();
  });

  it('answers 400 for an unknown, expired or used link', async () => {
    const { deps, users } = fakeDeps();
    users.consumeResetToken.mockResolvedValueOnce(undefined);

    await expect(createIdentityManager(deps).confirmPasswordReset(PUBLIC, CONFIRMATION))
      .rejects.toMatchObject({ apiError: { status: 400, code: 'password_reset.token_invalid' } });
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('still resets when the account vanished meanwhile, without touching a lock', async () => {
    const { deps, users } = fakeDeps();
    users.findById.mockResolvedValueOnce(undefined);

    await createIdentityManager(deps).confirmPasswordReset(PUBLIC, CONFIRMATION);

    expect(users.clearLoginFailures).not.toHaveBeenCalled();
  });
});
