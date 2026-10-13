import type { UserWithCredentials } from '../../accessors/userAccessor';
import { authentication } from '../../config/constants';
import {
  loggerFor, refreshTokenExpiry,
  type AuthTokens, type IdentityDeps, type RequestContext, type SignedInContext,
} from './context';
import { invalidCredentials, refreshInvalid, tooManyAttempts } from './errors';

// Login (uc-14), Refresh Tokens (uc-14b) and Logout (uc-15). The lockout rules
// are decided here (OQ-114); UserAccessor only counts, locks and clears.

const { loginLockout } = authentication;
const MINUTE_MS = 60_000;

/** What a user signs in with: password and MFA code together (OQ-30). */
export interface Credentials {
  readonly email: string;
  readonly password: string;
  readonly mfaCode: string;
}

/**
 * The key failed logins are counted under: the address as typed, trimmed and
 * lower-cased — not the user, so unknown addresses lock too (OQ-114).
 *
 * @param email - The email as typed.
 * @returns The key.
 */
export const emailKeyOf = (email: string): string => email.trim().toLowerCase();

/**
 * Builds the sign-in use cases.
 *
 * @param deps - The tier below.
 * @returns `login`, `refresh`, `logout`.
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
   * Checks every factor; the MFA code only once the password matched.
   *
   * @param user - The account for the email, if any.
   * @param credentials - What was typed.
   * @returns Whether the user exists and both factors are right.
   */
  const credentialsMatch = async (
    user: UserWithCredentials | undefined,
    credentials: Credentials,
  ): Promise<boolean> => {
    const hash = user?.passwordHash ?? await timingHash();
    const passwordOk = await auth.verifyPassword(hash, credentials.password);
    return !!user && passwordOk && auth.verifyTotp(user.encryptedMfaSecret, credentials.mfaCode);
  };

  /**
   * Counts a failed login, locking the address at the threshold (OQ-114).
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
   * Opens a session: a refresh token (stored only as a hash) and an access token
   * naming the session and the system role (OQ-106, OQ-111).
   *
   * @param user - Who signed in.
   * @param deviceInfo - The device, for the sessions list.
   * @param now - Current time.
   * @returns The tokens and the new session's id.
   */
  const openSession = async (
    user: UserWithCredentials,
    deviceInfo: string | null,
    now: Date,
  ): Promise<AuthTokens & { sessionId: string }> => {
    const refresh = auth.issueOpaqueToken();
    const expiresAt = refreshTokenExpiry(now);
    const session = await sessions.insert(user.id, refresh.tokenHash, deviceInfo, expiresAt, now);
    const accessToken = await auth.signAccessToken({
      userId: user.id, sessionId: session.id, systemRole: user.systemRole,
    });
    return { accessToken, refreshToken: refresh.token, sessionId: session.id };
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
     * Signs a user in with password and MFA code (uc-14, FR-1.2). Every failure
     * answers the same 401 and counts against the address; a locked address
     * answers 429 whether or not it has an account (OQ-114).
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
      const emailKey = emailKeyOf(credentials.email);
      const lockedUntil = await users.findLoginLock(emailKey);
      if (lockedUntil && lockedUntil > now) throw tooManyAttempts(lockedUntil, now);
      const user = await users.findByEmail(credentials.email.trim());
      // Always run the check first: an unknown email must cost a password check too.
      const matches = await credentialsMatch(user, credentials);
      if (!user || !matches) {
        await countFailure(emailKey, now);
        throw invalidCredentials();
      }
      await users.clearLoginFailures(emailKey);
      const { sessionId, ...tokens } = await openSession(user, deviceInfo, now);
      loggerFor(context, user.id)
        .audit('Login', { entityType: 'Session', entityId: sessionId, householdId: null });
      return tokens;
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
