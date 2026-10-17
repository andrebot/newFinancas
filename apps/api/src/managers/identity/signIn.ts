import type { UserWithCredentials } from '../../accessors/userAccessor';
import { authentication } from '../../config/constants';
import type { ApiError } from '../../http/apiError';
import type { ChallengeClaims } from '../../utilities/authentication';
import {
  emailKeyOf, enrollmentStart, loggerFor, refreshTokenExpiry,
  type AuthTokens, type EnrollmentStart, type IdentityDeps, type RequestContext,
  type SignedInContext,
} from './context';
import {
  challengeExpired, enrollmentExpired, invalidCredentials, mfaInvalid, refreshInvalid,
  tooManyAttempts,
} from './errors';

// Login (uc-14), MFA Recovery (uc-20), Refresh Tokens (uc-14b) and Logout
// (uc-15). Sign-in takes two steps (OQ-145): the password earns a five-minute
// challenge token, which the MFA code — or a single-use recovery code — trades
// for a session. The password step answers one 401 for every failure, so it
// never reveals a registered email (OQ-114); the second step names a wrong
// code, since its caller already proved the password. Both steps count against
// the same per-address lockout, and only a full sign-in clears it.
// UserAccessor only counts, locks and clears.
// An account whose MFA enrollment was never confirmed gets no challenge: the
// password step answers a fresh enrollment, whose first authenticator code
// confirms it and opens the session (OQ-149, uc-11b).

const { loginLockout, refreshToken: refreshPolicy } = authentication;
const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;

/** The password step's input (OQ-145). */
export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** What the password step answers: the challenge the second step needs. */
export interface Challenge {
  readonly step: 'mfa';
  readonly challengeToken: string;
}

/** What the password step answers while the MFA enrollment is unconfirmed (OQ-149). */
export interface EnrollmentStep extends EnrollmentStart {
  readonly step: 'enroll';
}

/** The password step's answer: an MFA challenge, or an enrollment to finish. */
export type LoginStep = Challenge | EnrollmentStep;

/** Confirms an MFA enrollment with its first authenticator code (OQ-149). */
export interface EnrollmentConfirmation {
  readonly enrollmentToken: string;
  readonly mfaCode: string;
}

/** The second step with the authenticator code (FR-1.2). */
export interface MfaVerification {
  readonly challengeToken: string;
  readonly mfaCode: string;
}

/** The second step with a single-use recovery code instead (FR-1.16). */
export interface RecoveryVerification {
  readonly challengeToken: string;
  readonly recoveryCode: string;
}

/** Checks the second factor of a user whose password matched. */
type SecondFactor = (user: UserWithCredentials) => boolean | Promise<boolean>;

/**
 * Builds the sign-in use cases.
 *
 * @param deps - The tier below.
 * @returns `login`, `verifyMfa`, `recoverWithCode`, `refresh`, `logout`.
 */
const createSignIn = (deps: IdentityDeps) => {
  const { users, sessions, authentication: auth } = deps;
  let dummyHash: Promise<string> | undefined;

  /**
   * A password hash to check against when no user matches, so an unknown email
   * costs the same Argon2 work as a known one (OQ-114). Made once, on first need.
   *
   * @returns The hash.
   */
  const timingHash = (): Promise<string> => {
    dummyHash ??= auth.hashPassword('timing-equaliser-not-a-password');
    return dummyHash;
  };

  /**
   * Counts a failed sign-in step, locking the address at the threshold (OQ-114).
   *
   * @param emailKey - The address.
   * @param now - Current time.
   */
  const countFailure = async (emailKey: string, now: Date): Promise<void> => {
    const windowStart = new Date(now.getTime() - loginLockout.windowMinutes * MINUTE_MS);
    const failures = await users.recordLoginFailure(emailKey, now, windowStart);
    if (failures >= loginLockout.maxFailures) {
      const until = new Date(now.getTime() + loginLockout.lockMinutes * MINUTE_MS);
      await users.lockLogin(emailKey, until);
    }
  };

  /**
   * Refuses an address that is still locked (OQ-114).
   *
   * @param emailKey - The address.
   * @param now - Current time.
   * @throws {ApiError} 429 `auth.too_many_attempts`.
   */
  const refuseIfLocked = async (emailKey: string, now: Date): Promise<void> => {
    const lockedUntil = await users.findLoginLock(emailKey);
    if (lockedUntil && lockedUntil > now) throw tooManyAttempts(lockedUntil, now);
  };

  /**
   * Checks the password — against a dummy hash when there is no user, so an
   * unknown email costs the same work.
   *
   * @param user - The account for the email, if any.
   * @param password - As typed.
   * @returns Whether the user exists and the password is theirs.
   */
  const passwordMatches = async (
    user: UserWithCredentials | undefined,
    password: string,
  ): Promise<boolean> => {
    const hash = user?.passwordHash ?? await timingHash();
    const matches = await auth.verifyPassword(hash, password);
    return !!user && matches;
  };

  /**
   * The step after the password, shared by the MFA code, the recovery code and
   * the enrollment's first code: checks the step token's claims, refuses a
   * locked address, checks the factor, counts a failure and clears the count on
   * success (OQ-145, OQ-149).
   *
   * @param claims - The step token's claims; `undefined` when it didn't verify.
   * @param expired - The rejection for a token that is not (or no longer) valid.
   * @param secondFactor - The code check.
   * @param now - Current time.
   * @returns The authenticated user.
   * @throws {ApiError} `expired()`; 429 `auth.too_many_attempts`; 401 `auth.mfa_invalid`.
   */
  const completeStep = async (
    claims: ChallengeClaims | undefined,
    expired: () => ApiError,
    secondFactor: SecondFactor,
    now: Date,
  ): Promise<UserWithCredentials> => {
    if (!claims) throw expired();
    const emailKey = emailKeyOf(claims.email);
    await refuseIfLocked(emailKey, now);
    const user = await users.findByEmail(claims.email);
    if (user?.id !== claims.userId) throw expired();
    if (!await secondFactor(user)) {
      await countFailure(emailKey, now);
      throw mfaInvalid();
    }
    await users.clearLoginFailures(emailKey);
    return user;
  };

  /**
   * Builds the authenticator-code check: right for the user's secret now, and
   * its time step not used before — the step is used up as it passes, so each
   * code works once (RFC 6238 §5.2, OQ-163).
   *
   * @param code - The code typed.
   * @returns The second-factor check.
   */
  const totpAccepted = (code: string): SecondFactor => async (user) => {
    const step = auth.verifyTotp(user.encryptedMfaSecret, code);
    return step !== undefined && users.consumeTotpStep(user.id, step);
  };

  /**
   * The ordinary answer to a matching password: a challenge for the MFA step.
   *
   * @param user - Whose password matched.
   * @returns The challenge.
   */
  const challengeFor = async (user: UserWithCredentials): Promise<Challenge> => ({
    step: 'mfa',
    challengeToken: await auth.signChallengeToken({ userId: user.id, email: user.email }),
  });

  /**
   * Starts the user's MFA enrollment over — a new secret and recovery codes
   * replacing the unconfirmed ones, which the client never showed or lost — and
   * audits it (OQ-149). Confirmed meanwhile: an ordinary challenge instead.
   *
   * @param context - The request.
   * @param user - Whose enrollment is unconfirmed.
   * @returns The enrollment to finish, or the challenge.
   */
  const restartEnrollment = async (
    context: RequestContext,
    user: UserWithCredentials,
  ): Promise<LoginStep> => {
    const mfa = auth.enrollMfa(user.email);
    const result = await users.replaceMfaEnrollment(user.id, {
      encryptedMfaSecret: mfa.encryptedSecret, recoveryCodeHashes: mfa.recoveryCodeHashes,
    });
    if (result === 'stale') return challengeFor(user);
    loggerFor(context, user.id)
      .audit('RestartMfaEnrollment', { entityType: 'User', entityId: user.id, householdId: null });
    return { step: 'enroll', ...await enrollmentStart(auth, user, mfa) };
  };

  /**
   * Opens a session: a refresh token (stored only as a hash) and an access token
   * naming the session and the system role (OQ-106, OQ-111), and audits it.
   *
   * @param context - The request.
   * @param user - Who signed in.
   * @param deviceInfo - The device, for the sessions list.
   * @param action - The audited action (`Login`, `MfaRecovery`).
   * @returns The tokens.
   */
  const openSession = async (
    context: RequestContext,
    user: UserWithCredentials,
    deviceInfo: string | null,
    action: string,
  ): Promise<AuthTokens> => {
    const now = deps.now();
    const refresh = auth.issueOpaqueToken();
    const expiresAt = refreshTokenExpiry(now);
    const session = await sessions.insert(user.id, refresh.tokenHash, deviceInfo, expiresAt, now);
    const accessToken = await auth.signAccessToken({
      userId: user.id, sessionId: session.id, systemRole: user.systemRole,
    });
    loggerFor(context, user.id)
      .audit(action, { entityType: 'Session', entityId: session.id, householdId: null });
    return { accessToken, refreshToken: refresh.token };
  };

  /**
   * Ends the session a replayed refresh token belongs to — that session only;
   * the user's other devices stay signed in (stakeholder decision, OQ-114).
   *
   * @param context - The request.
   * @param presentedHash - Hash of the token presented.
   */
  const endReplayedSession = async (
    context: RequestContext,
    presentedHash: string,
  ): Promise<void> => {
    const replayed = await sessions.findByReplacedToken(presentedHash);
    if (!replayed) return;
    await sessions.deleteForUser(replayed.userId, replayed.id);
    loggerFor(context, replayed.userId)
      .warn('Refresh token replayed — session ended', { sessionId: replayed.id });
  };

  /**
   * Trades a refresh token for a new one. The current token rotates; the one
   * a rotation replaced moments ago is reissued instead of treated as a replay
   * — a page reloaded mid-refresh never stored the new token (OQ-162).
   *
   * @param context - The request.
   * @param presentedHash - Hash of the token presented.
   * @param newHash - Hash of the replacement token.
   * @param now - Current time.
   * @returns `rotated` with the session, or `stale`.
   */
  const exchangeRefreshToken = async (
    context: RequestContext,
    presentedHash: string,
    newHash: string,
    now: Date,
  ) => {
    const expiresAt = refreshTokenExpiry(now);
    const rotated = await sessions.rotate(presentedHash, newHash, expiresAt, now);
    if (rotated.status === 'rotated') return rotated;
    const rotatedSince = new Date(now.getTime() - refreshPolicy.reuseGraceSeconds * SECOND_MS);
    const reissued = await sessions.reissueReplaced(
      presentedHash,
      newHash,
      expiresAt,
      rotatedSince,
      now,
    );
    if (reissued.status === 'rotated') {
      loggerFor(context, reissued.session.userId)
        .info('Replaced refresh token reused within the grace window', {
          sessionId: reissued.session.id,
        });
    }
    return reissued;
  };

  return {
    /**
     * The password step of sign-in (uc-14, OQ-145): refuses a locked address,
     * checks the password (a dummy hash when no user matches), counts any
     * failure and answers it the same way. Success does not clear the count —
     * only a full sign-in does, so the password can't buy endless code guesses.
     * An unconfirmed MFA enrollment is started over instead (OQ-149).
     *
     * @param context - The request.
     * @param credentials - Email and password.
     * @returns The challenge token for the second step, or the enrollment to finish.
     * @throws {ApiError} 429 `auth.too_many_attempts`; 401 `auth.invalid_credentials`.
     */
    login: async (context: RequestContext, credentials: Credentials): Promise<LoginStep> => {
      const now = deps.now();
      const emailKey = emailKeyOf(credentials.email);
      await refuseIfLocked(emailKey, now);
      const user = await users.findByEmail(credentials.email.trim());
      // Always run the check: an unknown email must cost a password check too.
      const matches = await passwordMatches(user, credentials.password);
      if (!user || !matches) {
        await countFailure(emailKey, now);
        throw invalidCredentials();
      }
      if (!user.mfaConfirmedAt) return restartEnrollment(context, user);
      return challengeFor(user);
    },

    /**
     * The second step with the authenticator code (uc-14, FR-1.2): opens a session.
     *
     * @param context - The request.
     * @param verification - Challenge token and MFA code.
     * @param deviceInfo - The device (User-Agent), for the sessions list.
     * @returns Access and refresh tokens.
     * @throws {ApiError} 401 `auth.challenge_expired`; 429 `auth.too_many_attempts`;
     *   401 `auth.mfa_invalid`.
     */
    verifyMfa: async (
      context: RequestContext,
      verification: MfaVerification,
      deviceInfo: string | null,
    ): Promise<AuthTokens> => {
      const claims = await auth.verifyChallengeToken(verification.challengeToken);
      const user = await completeStep(
        claims,
        challengeExpired,
        totpAccepted(verification.mfaCode),
        deps.now(),
      );
      return openSession(context, user, deviceInfo, 'Login');
    },

    /**
     * Confirms an MFA enrollment with its first authenticator code and opens a
     * session (uc-11b, OQ-149) — proof the app was set up. A wrong code counts
     * against the same lockout as sign-in; the confirmation is guarded, so a
     * token works for one confirmation only.
     *
     * @param context - The request.
     * @param confirmation - Enrollment token and authenticator code.
     * @param deviceInfo - The device (User-Agent), for the sessions list.
     * @returns Access and refresh tokens.
     * @throws {ApiError} 401 `auth.enrollment_expired`; 429 `auth.too_many_attempts`;
     *   401 `auth.mfa_invalid`.
     */
    confirmMfaEnrollment: async (
      context: RequestContext,
      confirmation: EnrollmentConfirmation,
      deviceInfo: string | null,
    ): Promise<AuthTokens> => {
      const now = deps.now();
      const claims = await auth.verifyEnrollmentToken(confirmation.enrollmentToken);
      const user = await completeStep(
        claims,
        enrollmentExpired,
        totpAccepted(confirmation.mfaCode),
        now,
      );
      if (await users.confirmMfaEnrollment(user.id, now) === 'stale') throw enrollmentExpired();
      return openSession(context, user, deviceInfo, 'ConfirmMfaEnrollment');
    },

    /**
     * The second step with a single-use recovery code in place of the MFA code
     * (uc-20, FR-1.16). The code is used up atomically, only when it is right.
     *
     * @param context - The request.
     * @param verification - Challenge token and recovery code.
     * @param deviceInfo - The device (User-Agent), for the sessions list.
     * @returns Access and refresh tokens.
     * @throws {ApiError} 401 `auth.challenge_expired`; 429 `auth.too_many_attempts`;
     *   401 `auth.mfa_invalid`.
     */
    recoverWithCode: async (
      context: RequestContext,
      verification: RecoveryVerification,
      deviceInfo: string | null,
    ): Promise<AuthTokens> => {
      const now = deps.now();
      const codeHash = auth.hashRecoveryCode(verification.recoveryCode);
      const codeConsumed: SecondFactor = (user) => (
        users.consumeRecoveryCode(user.id, codeHash, now)
      );
      const claims = await auth.verifyChallengeToken(verification.challengeToken);
      const user = await completeStep(claims, challengeExpired, codeConsumed, now);
      return openSession(context, user, deviceInfo, 'MfaRecovery');
    },

    /**
     * Exchanges a refresh token for a new pair; the old one is used up (uc-14b,
     * OQ-100). A replayed token ends its session — unless its rotation was
     * moments ago, when it is reissued instead (OQ-162).
     *
     * @param context - The request.
     * @param refreshToken - The token the client holds.
     * @returns New access and refresh tokens.
     * @throws {ApiError} 401 `auth.refresh_invalid`.
     */
    refresh: async (context: RequestContext, refreshToken: string): Promise<AuthTokens> => {
      const now = deps.now();
      const presentedHash = auth.hashOpaqueToken(refreshToken);
      const next = auth.issueOpaqueToken();
      const result = await exchangeRefreshToken(context, presentedHash, next.tokenHash, now);
      if (result.status === 'stale') {
        await endReplayedSession(context, presentedHash);
        throw refreshInvalid();
      }
      const user = await users.findById(result.session.userId);
      if (!user) throw refreshInvalid();
      const accessToken = await auth.signAccessToken({
        userId: user.id, sessionId: result.session.id, systemRole: user.systemRole,
      });
      return { accessToken, refreshToken: next.token };
    },

    /**
     * Ends the current session only (uc-15, FR-1.9). Idempotent.
     *
     * @param context - The signed-in request.
     */
    logout: async (context: SignedInContext): Promise<void> => {
      await sessions.deleteForUser(context.actor.userId, context.actor.sessionId);
      loggerFor(context).info('Logout');
    },
  };
};

export default createSignIn;
