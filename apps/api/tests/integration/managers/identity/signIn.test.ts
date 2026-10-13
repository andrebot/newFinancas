import { captureLogs } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import { emailKeyOf } from '../../../../src/managers/identity/context';
import {
  ANA, fakeDeps, minutes, NOW, SESSION,
} from './fakes';

const CONTEXT = { correlationId: 'c1' };
const CREDENTIALS = {
  email: ' Ana@Example.com ', password: 'correct horse battery', mfaCode: '123456',
};
const THIRTY_DAYS = minutes(30 * 24 * 60);

/**
 * Logs in with the shared credentials through a fresh Manager.
 *
 * @param deps - The mocked tier below.
 * @returns The login's promise.
 */
const loginWith = (deps: ReturnType<typeof fakeDeps>['deps']) => (
  createIdentityManager(deps).login(CONTEXT, CREDENTIALS, null)
);
const INVALID = { apiError: { status: 401, code: 'auth.invalid_credentials' } };

describe('IdentityManager — Login (uc-14, OQ-114)', () => {
  it('counts failures under the trimmed, lower-cased address', () => {
    expect(emailKeyOf(' Ana@Example.COM ')).toBe('ana@example.com');
  });

  it('opens a session with a hashed refresh token and a role-bearing access token', async () => {
    const {
      deps, users, sessions, authentication,
    } = fakeDeps();
    const logs = captureLogs();

    const tokens = await createIdentityManager(deps).login(CONTEXT, CREDENTIALS, 'Firefox');
    logs.stop();

    expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(users.findByEmail).toHaveBeenCalledWith('Ana@Example.com');
    expect(users.clearLoginFailures).toHaveBeenCalledWith('ana@example.com');
    expect(sessions.insert)
      .toHaveBeenCalledWith(ANA.id, 'refresh-hash', 'Firefox', THIRTY_DAYS, NOW);
    expect(authentication.signAccessToken).toHaveBeenCalledWith({
      userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER',
    });
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'audit', message: 'Login', entityType: 'Session', entityId: SESSION.id,
    }));
  });

  it('answers 429 while the address is locked, without checking anything', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(new Date(NOW.getTime() + 90_000));

    await expect(loginWith(deps)).rejects.toMatchObject({
      apiError: {
        status: 429,
        code: 'auth.too_many_attempts',
        params: { retryAfterMinutes: 2 },
        headers: { 'Retry-After': '90' },
      },
    });
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(authentication.verifyPassword).not.toHaveBeenCalled();
  });

  it('lets a lock that has ended pass', async () => {
    const { deps, users } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(minutes(-1));

    await expect(loginWith(deps)).resolves.toBeDefined();
  });

  it('checks a password even for an unknown email, gives the same 401, counts it', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findByEmail.mockResolvedValue(undefined);
    const identity = createIdentityManager(deps);

    await expect(identity.login(CONTEXT, CREDENTIALS, null)).rejects.toMatchObject(INVALID);
    await expect(identity.login(CONTEXT, CREDENTIALS, null)).rejects.toMatchObject(INVALID);

    expect(authentication.verifyPassword)
      .toHaveBeenCalledWith('hash(timing-equaliser-not-a-password)', CREDENTIALS.password);
    expect(authentication.hashPassword).toHaveBeenCalledTimes(1);
    expect(users.recordLoginFailure).toHaveBeenCalledWith('ana@example.com', NOW, minutes(-15));
  });

  it('gives the same 401 for a wrong password (code unchecked) and a wrong code', async () => {
    const { deps, authentication } = fakeDeps();
    authentication.verifyPassword.mockResolvedValueOnce(false);

    await expect(loginWith(deps)).rejects.toMatchObject(INVALID);
    expect(authentication.verifyTotp).not.toHaveBeenCalled();

    authentication.verifyTotp.mockReturnValueOnce(false);
    await expect(loginWith(deps)).rejects.toMatchObject(INVALID);
  });

  it('locks the address for 15 minutes at the fifth failure, not before', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyPassword.mockResolvedValue(false);
    users.recordLoginFailure.mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const identity = createIdentityManager(deps);

    await expect(identity.login(CONTEXT, CREDENTIALS, null)).rejects.toMatchObject(INVALID);
    expect(users.lockLogin).not.toHaveBeenCalled();
    await expect(identity.login(CONTEXT, CREDENTIALS, null)).rejects.toMatchObject(INVALID);
    expect(users.lockLogin).toHaveBeenCalledWith('ana@example.com', minutes(15));
  });
});

describe('IdentityManager — MFA Recovery (uc-20, OQ-115)', () => {
  const RECOVERY = {
    email: 'ana@example.com', password: 'correct horse battery', recoveryCode: 'abcd-efgh',
  };

  /**
   * Recovers with the shared credentials through a fresh Manager.
   *
   * @param deps - The mocked tier below.
   * @returns The recovery's promise.
   */
  const recoverWith = (deps: ReturnType<typeof fakeDeps>['deps']) => (
    createIdentityManager(deps).recoverWithCode(CONTEXT, RECOVERY, 'Phone')
  );

  it('uses up the code and opens an audited session', async () => {
    const { deps, users } = fakeDeps();
    const logs = captureLogs();

    await expect(recoverWith(deps))
      .resolves.toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    logs.stop();

    expect(users.consumeRecoveryCode).toHaveBeenCalledWith(ANA.id, 'code-hash(abcd-efgh)', NOW);
    expect(users.clearLoginFailures).toHaveBeenCalledWith('ana@example.com');
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'audit', message: 'MfaRecovery', entityType: 'Session',
    }));
  });

  it('never uses up a code when the password is wrong', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyPassword.mockResolvedValueOnce(false);

    await expect(recoverWith(deps)).rejects.toMatchObject(INVALID);
    expect(users.consumeRecoveryCode).not.toHaveBeenCalled();
    expect(users.recordLoginFailure).toHaveBeenCalled();
  });

  it('gives the same 401 for a used or unknown code, and counts it', async () => {
    const { deps, users } = fakeDeps();
    users.consumeRecoveryCode.mockResolvedValueOnce(false);

    await expect(recoverWith(deps)).rejects.toMatchObject(INVALID);
    expect(users.recordLoginFailure).toHaveBeenCalled();
  });

  it('is refused while the address is locked, like login', async () => {
    const { deps, users } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(minutes(5));

    await expect(recoverWith(deps))
      .rejects.toMatchObject({ apiError: { status: 429, code: 'auth.too_many_attempts' } });
    expect(users.consumeRecoveryCode).not.toHaveBeenCalled();
  });
});

describe('IdentityManager — Refresh Tokens (uc-14b)', () => {
  const REFRESH_INVALID = { apiError: { status: 401, code: 'auth.refresh_invalid' } };

  it('rotates the token and signs a new access token with the current system role', async () => {
    const { deps, sessions, authentication } = fakeDeps();

    const tokens = await createIdentityManager(deps).refresh(CONTEXT, 'old-token');

    expect(sessions.rotate)
      .toHaveBeenCalledWith('hash(old-token)', 'refresh-hash', THIRTY_DAYS, NOW);
    expect(authentication.signAccessToken).toHaveBeenCalledWith({
      userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER',
    });
    expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('ends only the session of a replayed token, and says so in the log', async () => {
    const { deps, sessions } = fakeDeps();
    sessions.rotate.mockResolvedValueOnce({ status: 'stale' } as never);
    sessions.findByReplacedToken.mockResolvedValueOnce({ id: SESSION.id, userId: ANA.id });
    const logs = captureLogs();

    await expect(createIdentityManager(deps).refresh(CONTEXT, 'old-token'))
      .rejects.toMatchObject(REFRESH_INVALID);
    logs.stop();

    expect(sessions.deleteForUser).toHaveBeenCalledWith(ANA.id, SESSION.id);
    expect(sessions.deleteAllExceptCurrent).not.toHaveBeenCalled();
    expect(logs.events)
      .toContainEqual(expect.objectContaining({ level: 'warn', sessionId: SESSION.id }));
  });

  it('rejects an unknown, expired or revoked token without ending anything', async () => {
    const { deps, sessions } = fakeDeps();
    sessions.rotate.mockResolvedValueOnce({ status: 'stale' } as never);

    await expect(createIdentityManager(deps).refresh(CONTEXT, 'x'))
      .rejects.toMatchObject(REFRESH_INVALID);
    expect(sessions.deleteForUser).not.toHaveBeenCalled();
  });

  it('rejects when the user is gone', async () => {
    const { deps, users } = fakeDeps();
    users.findById.mockResolvedValueOnce(undefined);

    await expect(createIdentityManager(deps).refresh(CONTEXT, 'x'))
      .rejects.toMatchObject(REFRESH_INVALID);
  });
});

describe('IdentityManager — Logout (uc-15)', () => {
  it('ends the current session only', async () => {
    const { deps, sessions } = fakeDeps();
    const actor = { userId: ANA.id, sessionId: SESSION.id, systemRole: 'USER' as const };

    await createIdentityManager(deps).logout({ correlationId: 'c1', actor });

    expect(sessions.deleteForUser).toHaveBeenCalledWith(ANA.id, SESSION.id);
  });
});
