import { authentication } from '../../config/constants';
import {
  emailKeyOf, loggerFor, type IdentityDeps, type RequestContext, type SignedInContext,
} from './context';
import {
  currentPasswordIncorrect, passwordTooShort, resetTokenInvalid, unauthenticated,
} from './errors';

// Change Password (uc-19, FR-1.14) and Reset Forgotten Password (uc-18,
// FR-1.13): both replace the password hash and end sessions — every other one
// on a change, every one on a reset (OQ-115).

const { password, passwordReset } = authentication;

/** A signed-in user's password change. */
export interface PasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/** The second step of a reset: the token from the link and the new password. */
export interface PasswordResetConfirmation {
  readonly token: string;
  readonly newPassword: string;
}

/**
 * Refuses a new password shorter than the minimum (FR-1.1) — checked before
 * anything else, so a too-short password never uses up a reset link (OQ-103).
 *
 * @param newPassword - The proposed password.
 * @throws {ApiError} 422 `password.too_short`.
 */
const requireLongEnough = (newPassword: string): void => {
  if (newPassword.length < password.minLength) throw passwordTooShort();
};

/**
 * Builds the password use cases.
 *
 * @param deps - The tier below.
 * @returns `changePassword`, `requestPasswordReset`, `confirmPasswordReset`.
 */
const createPasswords = (deps: IdentityDeps) => {
  const { users, sessions, authentication: auth } = deps;

  /**
   * Issues and emails a reset link when the address has an account; nothing
   * otherwise. Runs after the response is sent (see `requestPasswordReset`).
   *
   * @param context - The request.
   * @param email - The address as typed.
   */
  const sendResetLink = async (context: RequestContext, email: string): Promise<void> => {
    const user = await users.findByEmail(email.trim());
    if (!user) return;
    const now = deps.now();
    const { token, tokenHash } = auth.issueOpaqueToken();
    const expiresAt = new Date(now.getTime() + passwordReset.ttlMinutes * 60_000);
    await users.storeResetToken(user.id, tokenHash, expiresAt);
    const resetLink = `${deps.webAppUrl}${passwordReset.path}?token=${encodeURIComponent(token)}`;
    await deps.notifications.notify(
      'password.reset',
      { email: user.email, language: user.language },
      { resetLink, expiresInMinutes: passwordReset.ttlMinutes },
    );
    loggerFor(context, user.id).info('Password reset link sent');
  };

  return {
    /**
     * Changes the caller's password, re-checking the current one, and ends every
     * other session — this one survives (uc-19, FR-1.14).
     *
     * @param context - The signed-in request.
     * @param change - Current and new password.
     * @throws {ApiError} 422 `password.too_short`; 422 `password.current_incorrect`
     *   (not 401: the user is signed in and stays so — OQ-115).
     */
    changePassword: async (context: SignedInContext, change: PasswordChange): Promise<void> => {
      requireLongEnough(change.newPassword);
      const { userId, sessionId } = context.actor;
      const currentHash = await users.findPasswordHash(userId);
      if (!currentHash) throw unauthenticated();
      if (!(await auth.verifyPassword(currentHash, change.currentPassword))) {
        throw currentPasswordIncorrect();
      }
      await users.updatePasswordHash(userId, await auth.hashPassword(change.newPassword));
      await sessions.deleteAllExceptCurrent(userId, sessionId);
      loggerFor(context)
        .audit('ChangePassword', { entityType: 'User', entityId: userId, householdId: null });
    },

    /**
     * Starts a reset (uc-18 step 1). Answers at once, whatever the address: the
     * lookup, token and email happen afterwards, so neither the answer nor its
     * timing reveals whether an account exists (OQ-115). A failure there is
     * logged, never returned.
     *
     * @param context - The request.
     * @param email - The address as typed.
     */
    requestPasswordReset: async (context: RequestContext, email: string): Promise<void> => {
      sendResetLink(context, email).catch((error: unknown) => {
        loggerFor(context).error('Password reset link not sent', { error: String(error) });
      });
    },

    /**
     * Completes a reset (uc-18 step 2): uses up the link, replaces the password,
     * ends every session, and lifts any login lock on the address (OQ-115).
     *
     * @param context - The request.
     * @param confirmation - The link's token and the new password.
     * @throws {ApiError} 422 `password.too_short`; 400 `password_reset.token_invalid`.
     */
    confirmPasswordReset: async (
      context: RequestContext,
      confirmation: PasswordResetConfirmation,
    ): Promise<void> => {
      requireLongEnough(confirmation.newPassword);
      const tokenHash = auth.hashOpaqueToken(confirmation.token);
      const userId = await users.consumeResetToken(tokenHash, deps.now());
      if (!userId) throw resetTokenInvalid();
      await users.updatePasswordHash(userId, await auth.hashPassword(confirmation.newPassword));
      await sessions.deleteAllForUser(userId);
      const user = await users.findById(userId);
      if (user) await users.clearLoginFailures(emailKeyOf(user.email));
      loggerFor(context, userId)
        .audit('ResetPassword', { entityType: 'User', entityId: userId, householdId: null });
    },
  };
};

export default createPasswords;
