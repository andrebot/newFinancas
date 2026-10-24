import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import { emailKeyOf } from '../../../../src/managers/identity/context';
import {
  ANA, fakeDeps, minutes, NOW, SESSION, TOTP_STEP,
} from './fakes';

const CONTEXT = { correlationId: 'c1' };
const CREDENTIALS = { email: ' Ana@Example.com ', password: 'correct horse battery' };
const VERIFICATION = { challengeToken: 'challenge-token', mfaCode: '123456' };
const THIRTY_DAYS = minutes(30 * 24 * 60);

type Deps = ReturnType<typeof fakeDeps>['deps'];

/**
 * Runs the password step with the shared credentials through a fresh Manager.
 *
 * @param deps - The mocked tier below.
 * @returns The login's promise.
 */
const loginWith = (deps: Deps) => createIdentityManager(deps).login(CONTEXT, CREDENTIALS);

/**
 * Runs the MFA step with the shared verification through a fresh Manager.
 *
 * @param deps - The mocked tier below.
 * @returns The verification's promise.
 */
const verifyWith = (deps: Deps) => (
  createIdentityManager(deps).verifyMfa(CONTEXT, VERIFICATION, 'Firefox')
);
const INVALID = { domainError: { code: 'auth.invalid_credentials' } };
const MFA_INVALID = { domainError: { code: 'auth.mfa_invalid' } };
const EXPIRED = { domainError: { code: 'auth.challenge_expired' } };
const LOCKED = { domainError: { code: 'auth.too_many_attempts' } };

describe('IdentityManager — Login, password step (uc-14, OQ-114, OQ-145)', () => {
  it('counts failures under the trimmed, lower-cased address', () => {
    expect(emailKeyOf(' Ana@Example.COM ')).toBe('ana@example.com');
  });

  it('answers a challenge naming the user, opening no session, clearing nothing', async () => {
    const {
      deps, users, sessions, authentication,
    } = fakeDeps();

    await expect(loginWith(deps))
      .resolves.toEqual({ step: 'mfa', challengeToken: 'challenge-token' });

    expect(users.findByEmail).toHaveBeenCalledWith('Ana@Example.com');
    expect(authentication.signChallengeToken)
      .toHaveBeenCalledWith({ userId: ANA.id, email: ANA.email });
    expect(users.clearLoginFailures).not.toHaveBeenCalled();
    expect(sessions.insert).not.toHaveBeenCalled();
    expect(authentication.verifyTotp).not.toHaveBeenCalled();
  });

  it('answers 429 while the address is locked, without checking anything', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(new Date(NOW.getTime() + 90_000));

    await expect(loginWith(deps)).rejects.toMatchObject({
      domainError: {
        code: 'auth.too_many_attempts',
        params: { retryAfterMinutes: 2 },
        retryAfterSeconds: 90,
      },
    });
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(authentication.verifyPassword).not.toHaveBeenCalled();
  });

  it.each([
    ['ended a minute ago', minutes(-1)],
    ['ends this very moment', NOW],
  ])('lets a lock that %s pass', async (_case, lockedUntil) => {
    const { deps, users } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(lockedUntil);

    await expect(loginWith(deps)).resolves.toBeDefined();
  });

  it('checks a password even for an unknown email, gives the same 401, counts it', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findByEmail.mockResolvedValue(undefined);
    const identity = createIdentityManager(deps);

    await expect(identity.login(CONTEXT, CREDENTIALS)).rejects.toMatchObject(INVALID);
    await expect(identity.login(CONTEXT, CREDENTIALS)).rejects.toMatchObject(INVALID);

    expect(authentication.verifyPassword)
      .toHaveBeenCalledWith('hash(timing-equaliser-not-a-password)', CREDENTIALS.password);
    expect(authentication.hashPassword).toHaveBeenCalledTimes(1);
    expect(users.recordLoginFailure).toHaveBeenCalledWith('ana@example.com', NOW, minutes(-15));
    expect(authentication.signChallengeToken).not.toHaveBeenCalled();
  });

  it('gives the same 401 for a wrong password, and counts it', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyPassword.mockResolvedValueOnce(false);

    await expect(loginWith(deps)).rejects.toMatchObject(INVALID);
    expect(users.recordLoginFailure).toHaveBeenCalled();
    expect(authentication.signChallengeToken).not.toHaveBeenCalled();
  });

  it('locks the address for 15 minutes at the fifth failure, not before', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyPassword.mockResolvedValue(false);
    users.recordLoginFailure.mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const identity = createIdentityManager(deps);

    await expect(identity.login(CONTEXT, CREDENTIALS)).rejects.toMatchObject(INVALID);
    expect(users.lockLogin).not.toHaveBeenCalled();
    await expect(identity.login(CONTEXT, CREDENTIALS)).rejects.toMatchObject(INVALID);
    expect(users.lockLogin).toHaveBeenCalledWith('ana@example.com', minutes(15));
  });
});

describe('IdentityManager — Login, unconfirmed MFA enrollment (uc-14, OQ-149)', () => {
  const UNCONFIRMED = { ...ANA, mfaConfirmedAt: null };

  it('starts the enrollment over instead of a challenge, and audits it', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(UNCONFIRMED);
    const logs = captureLogs(onTestFinished);

    const answer = await loginWith(deps);

    expect(answer).toEqual({
      step: 'enroll',
      enrollmentToken: 'enrollment-token',
      totpSecret: 'TOTPSECRET',
      otpauthUri: 'otpauth://totp/x',
      recoveryCodes: ['CODE1', 'CODE2'],
    });
    expect(authentication.enrollMfa).toHaveBeenCalledWith(ANA.email);
    expect(users.replaceMfaEnrollment).toHaveBeenCalledWith(ANA.id, {
      encryptedMfaSecret: 'sealed-new', recoveryCodeHashes: ['h1', 'h2'],
    });
    expect(authentication.signChallengeToken).not.toHaveBeenCalled();
    expect(users.clearLoginFailures).not.toHaveBeenCalled();
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'audit', message: 'RestartMfaEnrollment', entityType: 'User', entityId: ANA.id,
    }));
  });

  it('answers the challenge when the enrollment was confirmed meanwhile', async () => {
    const { deps, users } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(UNCONFIRMED);
    users.replaceMfaEnrollment.mockResolvedValueOnce('stale');

    await expect(loginWith(deps))
      .resolves.toEqual({ step: 'mfa', challengeToken: 'challenge-token' });
  });

  it('never starts it over for a wrong password', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(UNCONFIRMED);
    authentication.verifyPassword.mockResolvedValueOnce(false);

    await expect(loginWith(deps)).rejects.toMatchObject(INVALID);
    expect(authentication.enrollMfa).not.toHaveBeenCalled();
    expect(users.replaceMfaEnrollment).not.toHaveBeenCalled();
  });
});

describe('IdentityManager — Confirm MFA Enrollment (uc-11b, OQ-149)', () => {
  const CONFIRMATION = { enrollmentToken: 'enrollment-token', mfaCode: '123456' };
  const ENROLLMENT_EXPIRED = { domainError: { code: 'auth.enrollment_expired' } };

  /**
   * Confirms with the shared confirmation through a fresh Manager.
   *
   * @param deps - The mocked tier below.
   * @returns The confirmation's promise.
   */
  const confirmWith = (deps: Deps) => (
    createIdentityManager(deps).confirmMfaEnrollment(CONTEXT, CONFIRMATION, 'Firefox')
  );

  it('confirms the enrollment, clears the count and opens an audited session', async () => {
    const {
      deps, users, sessions, authentication,
    } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const tokens = await confirmWith(deps);

    expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(authentication.verifyEnrollmentToken).toHaveBeenCalledWith('enrollment-token');
    expect(authentication.verifyTotp).toHaveBeenCalledWith('sealed-secret', '123456');
    expect(users.consumeTotpStep).toHaveBeenCalledWith(ANA.id, TOTP_STEP);
    expect(users.confirmMfaEnrollment).toHaveBeenCalledWith(ANA.id, NOW);
    expect(users.clearLoginFailures).toHaveBeenCalledWith('ana@example.com');
    expect(sessions.insert)
      .toHaveBeenCalledWith(ANA.id, 'refresh-hash', 'Firefox', THIRTY_DAYS, NOW);
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'audit', message: 'ConfirmMfaEnrollment', entityType: 'Session', entityId: SESSION.id,
    }));
  });

  it('refuses a code already used, counting it, and confirms nothing (OQ-163)', async () => {
    const { deps, users } = fakeDeps();
    users.consumeTotpStep.mockResolvedValueOnce(false);

    await expect(confirmWith(deps)).rejects.toMatchObject(MFA_INVALID);
    expect(users.recordLoginFailure).toHaveBeenCalledWith('ana@example.com', NOW, minutes(-15));
    expect(users.confirmMfaEnrollment).not.toHaveBeenCalled();
  });

  it('names a wrong code, counts it, and confirms nothing', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyTotp.mockReturnValueOnce(undefined);

    await expect(confirmWith(deps)).rejects.toMatchObject(MFA_INVALID);
    expect(users.recordLoginFailure).toHaveBeenCalledWith('ana@example.com', NOW, minutes(-15));
    expect(users.confirmMfaEnrollment).not.toHaveBeenCalled();
  });

  it('refuses a locked address before checking the code', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(minutes(5));

    await expect(confirmWith(deps)).rejects.toMatchObject(LOCKED);
    expect(authentication.verifyTotp).not.toHaveBeenCalled();
  });

  it('answers enrollment_expired for an invalid token, uncounted', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyEnrollmentToken.mockResolvedValueOnce(undefined);

    await expect(confirmWith(deps)).rejects.toMatchObject(ENROLLMENT_EXPIRED);
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.recordLoginFailure).not.toHaveBeenCalled();
  });

  it.each([
    ['is gone', undefined],
    ['now has another account', { ...ANA, id: 'someone-else' }],
  ])('answers enrollment_expired when the enrolling address %s', async (_case, found) => {
    const { deps, users, authentication } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(found as typeof ANA | undefined);

    await expect(confirmWith(deps)).rejects.toMatchObject(ENROLLMENT_EXPIRED);
    expect(authentication.verifyTotp).not.toHaveBeenCalled();
    expect(users.confirmMfaEnrollment).not.toHaveBeenCalled();
  });

  it('answers enrollment_expired once already confirmed, opening no session', async () => {
    const { deps, users, sessions } = fakeDeps();
    users.confirmMfaEnrollment.mockResolvedValueOnce('stale');

    await expect(confirmWith(deps)).rejects.toMatchObject(ENROLLMENT_EXPIRED);
    expect(sessions.insert).not.toHaveBeenCalled();
  });
});

describe('IdentityManager — Login, MFA step (uc-14, OQ-145)', () => {
  it('opens a session with a hashed refresh token and a role-bearing access token', async () => {
    const {
      deps, users, sessions, authentication,
    } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const tokens = await verifyWith(deps);

    expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(authentication.verifyChallengeToken).toHaveBeenCalledWith('challenge-token');
    expect(users.findByEmail).toHaveBeenCalledWith(ANA.email);
    expect(authentication.verifyTotp).toHaveBeenCalledWith('sealed-secret', '123456');
    expect(users.consumeTotpStep).toHaveBeenCalledWith(ANA.id, TOTP_STEP);
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

  it('names a wrong code, counts it against the lockout, and clears nothing', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyTotp.mockReturnValueOnce(undefined);

    await expect(verifyWith(deps)).rejects.toMatchObject(MFA_INVALID);
    expect(users.consumeTotpStep).not.toHaveBeenCalled();
    expect(users.recordLoginFailure).toHaveBeenCalledWith('ana@example.com', NOW, minutes(-15));
    expect(users.clearLoginFailures).not.toHaveBeenCalled();
  });

  it('refuses a code already used, like a wrong one (OQ-163)', async () => {
    const { deps, users, sessions } = fakeDeps();
    users.consumeTotpStep.mockResolvedValueOnce(false);

    await expect(verifyWith(deps)).rejects.toMatchObject(MFA_INVALID);
    expect(users.recordLoginFailure).toHaveBeenCalledWith('ana@example.com', NOW, minutes(-15));
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it('locks the address at the fifth failure, code guesses included', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyTotp.mockReturnValueOnce(undefined);
    users.recordLoginFailure.mockResolvedValueOnce(5);

    await expect(verifyWith(deps)).rejects.toMatchObject(MFA_INVALID);
    expect(users.lockLogin).toHaveBeenCalledWith('ana@example.com', minutes(15));
  });

  it('refuses a locked address before checking the code', async () => {
    const { deps, users, authentication } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(minutes(5));

    await expect(verifyWith(deps)).rejects.toMatchObject(LOCKED);
    expect(users.findLoginLock).toHaveBeenCalledWith('ana@example.com');
    expect(authentication.verifyTotp).not.toHaveBeenCalled();
  });

  it('answers challenge_expired for an invalid or expired challenge, uncounted', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyChallengeToken.mockResolvedValueOnce(undefined);

    await expect(verifyWith(deps)).rejects.toMatchObject(EXPIRED);
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.recordLoginFailure).not.toHaveBeenCalled();
  });

  it.each([
    ['is gone', undefined],
    ['now has another account', { ...ANA, id: 'someone-else' }],
  ])('answers challenge_expired when the challenged address %s', async (_case, found) => {
    const { deps, users, authentication } = fakeDeps();
    users.findByEmail.mockResolvedValueOnce(found as typeof ANA | undefined);

    await expect(verifyWith(deps)).rejects.toMatchObject(EXPIRED);
    expect(authentication.verifyTotp).not.toHaveBeenCalled();
  });
});

describe('IdentityManager — MFA Recovery (uc-20, OQ-115, OQ-145)', () => {
  const RECOVERY = { challengeToken: 'challenge-token', recoveryCode: 'abcd-efgh' };

  /**
   * Recovers with the shared verification through a fresh Manager.
   *
   * @param deps - The mocked tier below.
   * @returns The recovery's promise.
   */
  const recoverWith = (deps: Deps) => (
    createIdentityManager(deps).recoverWithCode(CONTEXT, RECOVERY, 'Phone')
  );

  it('uses up the code and opens an audited session', async () => {
    const { deps, users } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await expect(recoverWith(deps))
      .resolves.toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });

    expect(users.consumeRecoveryCode).toHaveBeenCalledWith(ANA.id, 'code-hash(abcd-efgh)', NOW);
    expect(users.clearLoginFailures).toHaveBeenCalledWith('ana@example.com');
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'audit', message: 'MfaRecovery', entityType: 'Session',
    }));
  });

  it('never uses up a code without a valid challenge', async () => {
    const { deps, users, authentication } = fakeDeps();
    authentication.verifyChallengeToken.mockResolvedValueOnce(undefined);

    await expect(recoverWith(deps)).rejects.toMatchObject(EXPIRED);
    expect(users.consumeRecoveryCode).not.toHaveBeenCalled();
  });

  it('names a used or unknown code, and counts it', async () => {
    const { deps, users } = fakeDeps();
    users.consumeRecoveryCode.mockResolvedValueOnce(false);

    await expect(recoverWith(deps)).rejects.toMatchObject(MFA_INVALID);
    expect(users.recordLoginFailure).toHaveBeenCalled();
  });

  it('is refused while the address is locked, like login', async () => {
    const { deps, users } = fakeDeps();
    users.findLoginLock.mockResolvedValueOnce(minutes(5));

    await expect(recoverWith(deps)).rejects.toMatchObject(LOCKED);
    expect(users.consumeRecoveryCode).not.toHaveBeenCalled();
  });
});

describe('IdentityManager — Refresh Tokens (uc-14b)', () => {
  const REFRESH_INVALID = { domainError: { code: 'auth.refresh_invalid' } };

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

  it('reissues a token replaced in the last 10 s instead of ending its session', async () => {
    const { deps, sessions } = fakeDeps();
    sessions.rotate.mockResolvedValueOnce({ status: 'stale' } as never);
    sessions.reissueReplaced.mockResolvedValueOnce({ status: 'rotated', session: SESSION });
    const logs = captureLogs(onTestFinished);

    const tokens = await createIdentityManager(deps).refresh(CONTEXT, 'old-token');

    const graceStart = new Date(NOW.getTime() - 10_000);
    expect(sessions.reissueReplaced)
      .toHaveBeenCalledWith('hash(old-token)', 'refresh-hash', THIRTY_DAYS, graceStart, NOW);
    expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(sessions.findByReplacedToken).not.toHaveBeenCalled();
    expect(sessions.deleteForUser).not.toHaveBeenCalled();
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'info',
      message: 'Replaced refresh token reused within the grace window',
      sessionId: SESSION.id,
    }));
  });

  it('ends only the session of a replayed token, and says so in the log', async () => {
    const { deps, sessions } = fakeDeps();
    sessions.rotate.mockResolvedValueOnce({ status: 'stale' } as never);
    sessions.findByReplacedToken.mockResolvedValueOnce({ id: SESSION.id, userId: ANA.id });
    const logs = captureLogs(onTestFinished);

    await expect(createIdentityManager(deps).refresh(CONTEXT, 'old-token'))
      .rejects.toMatchObject(REFRESH_INVALID);

    expect(sessions.reissueReplaced).toHaveBeenCalled();
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
