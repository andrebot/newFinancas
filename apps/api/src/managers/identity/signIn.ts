import type { UserWithCredentials } from '../../accessors/userAccessor';
import { authentication } from '../../config/constants';
import {
  emailKeyOf, loggerFor, refreshTokenExpiry,
  type AuthTokens, type IdentityDeps, type RequestContext, type SignedInContext,
} from './context';
import { invalidCredentials, refreshInvalid, tooManyAttempts } from './errors';

// Login (uc-14), MFA Recovery (uc-20), Refresh Tokens (uc-14b) and Logout
// (uc-15). Login and MFA recovery share one authentication step — the lockout,
// the password check, one answer for every failure — and differ only in the
// second factor (OQ-114, OQ-115). UserAccessor only counts, locks and clears.

const { loginLockout } = authentication;
const MINUTE_MS = 60_000;

/** What a user signs in with: password and MFA code together (OQ-30). */
export interface Credentials {
  readonly email: string;
  readonly password: string;
  readonly mfaCode: string;
}

/** Signing in with a single-use recovery code instead of the MFA code (FR-1.16). */
export interface RecoveryCredentials {
  readonly email: string;
  readonly password: string;
  readonly recoveryCode: string;
}

/** Checks the second factor of a user whose password matched. */
type SecondFactor = (user: UserWithCredentials) => boolean | Promise<boolean>;

/**
 * Builds the sign-in use cases.
 *
 * @param deps - The tier below.
 * @returns `login`, `recoverWithCode`, `refresh`, `logout`.
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
   * Counts a failed sign-in, locking the address at the threshold (OQ-114).
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
   * unknown email costs the same work — then, only if it matched, the second
   * factor (so a recovery code isn't used up by a wrong password).
   *
   * @param user - The account for the email, if any.
   * @param password - As typed.
   * @param secondFactor - The MFA code or recovery-code check.
   * @returns Whether the user exists and both factors are right.
   */
  const factorsMatch = async (
    user: UserWithCredentials | undefined,
    password: string,
    secondFactor: SecondFactor,
  ): Promise<boolean> => {
    const hash = user?.passwordHash ?? await timingHash();
    const passwordMatches = await auth.verifyPassword(hash, password);
    return !!user && passwordMatches && secondFactor(user);
  };

  /**
   * The shared authentication step: refuses a locked address, checks the
   * password (a dummy hash when no user matches) and then the second factor,
   * counts any failure and answers it the same way, and clears the count on
   * success (OQ-114).
   *
   * @param email - As typed.
   * @param password - As typed.
   * @param secondFactor - The MFA code or recovery-code check.
   * @param now - Current time.
   * @returns The authenticated user.
   * @throws {ApiError} 429 `auth.too_many_attempts`; 401 `auth.invalid_credentials`.
   */
  const authenticate = async (
    email: string,
    password: string,
    secondFactor: SecondFactor,
    now: Date,
  ): Promise<UserWithCredentials> => {
    const emailKey = emailKeyOf(email);
    await refuseIfLocked(emailKey, now);
    const user = await users.findByEmail(email.trim());
    // Always run the check: an unknown email must cost a password check too.
    const matches = await factorsMatch(user, password, secondFactor);
    if (!user || !matches) {
      await countFailure(emailKey, now);
      throw invalidCredentials();
    }
    await users.clearLoginFailures(emailKey);
    return user;
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

  return {
    /**
     * Signs a user in with password and MFA code (uc-14, FR-1.2).
     *
     * @param context - The request.
     * @param credentials - Email, password, MFA code.
     * @param deviceInfo - The device (User-Agent), for the sessions list.
     * @returns Access and refresh tokens.
     * @throws {ApiError} 429 `auth.too_many_attempts`; 401 `auth.invalid_credentials`.
     */
    login: async (
      context: RequestContext,
      credentials: Credentials,
      deviceInfo: string | null,
    ): Promise<AuthTokens> => {
      const now = deps.now();
      const totpMatches: SecondFactor = (user) => (
        auth.verifyTotp(user.encryptedMfaSecret, credentials.mfaCode)
      );
      const user = await authenticate(credentials.email, credentials.password, totpMatches, now);
      return openSession(context, user, deviceInfo, 'Login');
    },

    /**
     * Signs a user in with a single-use recovery code in place of the MFA code
     * (uc-20, FR-1.16). Same lockout and same single answer as login; the code
     * is used up atomically, only once the password matched.
     *
     * @param context - The request.
     * @param credentials - Email, password, recovery code.
     * @param deviceInfo - The device (User-Agent), for the sessions list.
     * @returns Access and refresh tokens.
     * @throws {ApiError} 429 `auth.too_many_attempts`; 401 `auth.invalid_credentials`.
     */
    recoverWithCode: async (
      context: RequestContext,
      credentials: RecoveryCredentials,
      deviceInfo: string | null,
    ): Promise<AuthTokens> => {
      const now = deps.now();
      const codeHash = auth.hashRecoveryCode(credentials.recoveryCode);
      const codeConsumed: SecondFactor = (user) => (
        users.consumeRecoveryCode(user.id, codeHash, now)
      );
      const user = await authenticate(credentials.email, credentials.password, codeConsumed, now);
      return openSession(context, user, deviceInfo, 'MfaRecovery');
    },

    /**
     * Exchanges a refresh token for a new pair; the old one is used up (uc-14b,
     * OQ-100). A replayed token ends its session.
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
      const expiresAt = refreshTokenExpiry(now);
      const result = await sessions.rotate(presentedHash, next.tokenHash, expiresAt, now);
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
