import { authentication } from '../../config/constants';
import { createApiError, type ApiError } from '../../http/apiError';

// IdentityManager's rejections. A Manager answers with the contract's code and
// status itself (OQ-114): choosing 401 vs 404 vs 409 here is part of its
// security decisions (enumeration avoidance, one answer for every login failure).

/**
 * A failed password step — unknown email or wrong password — gives this one
 * answer, so it never reveals which emails are registered (OQ-114, OQ-145).
 *
 * @returns 401 `auth.invalid_credentials`.
 */
export const invalidCredentials = (): ApiError => createApiError({
  status: 401, code: 'auth.invalid_credentials', message: 'Invalid credentials',
});

/**
 * A wrong MFA or recovery code. Said plainly: whoever reaches this step already
 * proved the password, so naming the factor reveals nothing (OQ-145).
 *
 * @returns 401 `auth.mfa_invalid`.
 */
export const mfaInvalid = (): ApiError => createApiError({
  status: 401, code: 'auth.mfa_invalid', message: 'Invalid MFA or recovery code',
});

/**
 * An MFA challenge token that is expired, forged, or names a user who is gone:
 * the client starts again from the password (OQ-145).
 *
 * @returns 401 `auth.challenge_expired`.
 */
export const challengeExpired = (): ApiError => createApiError({
  status: 401, code: 'auth.challenge_expired', message: 'Sign-in challenge expired',
});

/**
 * An MFA enrollment token that is expired or forged, names a user who is gone,
 * or whose enrollment is already confirmed: the client signs in again, which
 * answers a fresh enrollment while it is unconfirmed (OQ-149).
 *
 * @returns 401 `auth.enrollment_expired`.
 */
export const enrollmentExpired = (): ApiError => createApiError({
  status: 401, code: 'auth.enrollment_expired', message: 'MFA enrollment expired',
});

/**
 * An address locked after too many failed logins (OQ-114).
 *
 * @param lockedUntil - When it unlocks.
 * @param now - Current time.
 * @returns 429 `auth.too_many_attempts` with the wait, in minutes and as `Retry-After`.
 */
export const tooManyAttempts = (lockedUntil: Date, now: Date): ApiError => {
  const seconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
  return createApiError({
    status: 429,
    code: 'auth.too_many_attempts',
    message: 'Too many failed login attempts',
    params: { retryAfterMinutes: Math.ceil(seconds / 60) },
    headers: { 'Retry-After': String(seconds) },
  });
};

/**
 * A refresh token that is unknown, expired, revoked or already used.
 *
 * @returns 401 `auth.refresh_invalid`.
 */
export const refreshInvalid = (): ApiError => createApiError({
  status: 401, code: 'auth.refresh_invalid', message: 'Refresh token is not valid',
});

/**
 * A password shorter than the minimum (FR-1.1).
 *
 * @returns 422 `password.too_short` with `min`.
 */
export const passwordTooShort = (): ApiError => createApiError({
  status: 422,
  code: 'password.too_short',
  message: 'Password is too short',
  params: { min: authentication.password.minLength },
});

/**
 * Registering an email that already has an account.
 *
 * @returns 409 `user.email_taken`.
 */
export const emailTaken = (): ApiError => createApiError({
  status: 409, code: 'user.email_taken', message: 'Email already registered',
});

/**
 * A session that doesn't exist or isn't the caller's (both → 404, OQ-106).
 *
 * @returns 404 `session.not_found`.
 */
export const sessionNotFound = (): ApiError => createApiError({
  status: 404, code: 'session.not_found', message: 'Session not found',
});

/**
 * A signed-in user typed the wrong current password. 422, not 401: a 401 would
 * make the web app treat the session as expired and sign the user out (OQ-115).
 *
 * @returns 422 `password.current_incorrect`.
 */
export const currentPasswordIncorrect = (): ApiError => createApiError({
  status: 422, code: 'password.current_incorrect', message: 'Current password is incorrect',
});

/**
 * A reset link that is unknown, expired or already used (FR-1.13).
 *
 * @returns 400 `password_reset.token_invalid`.
 */
export const resetTokenInvalid = (): ApiError => createApiError({
  status: 400, code: 'password_reset.token_invalid', message: 'Reset token is not valid',
});

/**
 * The signed-in account no longer exists.
 *
 * @returns 401 `auth.unauthenticated`.
 */
export const unauthenticated = (): ApiError => createApiError({
  status: 401, code: 'auth.unauthenticated', message: 'Account no longer exists',
});

/**
 * The household doesn't exist or the caller isn't a member — the same answer
 * for both, so it never confirms a household exists (OQ-117).
 *
 * @returns 404 `household.not_found`.
 */
export const householdNotFound = (): ApiError => createApiError({
  status: 404, code: 'household.not_found', message: 'Household not found',
});

/**
 * A member without the household role an action needs (FR-1.7, OQ-111).
 *
 * @returns 403 `auth.forbidden`.
 */
export const forbidden = (): ApiError => createApiError({
  status: 403, code: 'auth.forbidden', message: 'Not permitted in this household',
});

/**
 * The person acted on isn't a member of the household.
 *
 * @returns 404 `household.member_not_found`.
 */
export const memberNotFound = (): ApiError => createApiError({
  status: 404, code: 'household.member_not_found', message: 'Not a member of this household',
});

/**
 * The membership changed while the request ran, and retrying didn't settle it
 * (OQ-107).
 *
 * @returns 409 `household.changed`.
 */
export const householdChanged = (): ApiError => createApiError({
  status: 409, code: 'household.changed', message: 'Household membership changed concurrently',
});

/**
 * No invitation with that id in that household, or not the caller's to answer —
 * the same answer for both, so it never confirms one exists (OQ-118).
 *
 * @returns 404 `invitation.not_found`.
 */
export const invitationNotFound = (): ApiError => createApiError({
  status: 404, code: 'invitation.not_found', message: 'Invitation not found',
});

/**
 * Invitations only reach registered users (FR-1.19, OQ-26).
 *
 * @returns 404 `invitation.invitee_not_registered`.
 */
export const inviteeNotRegistered = (): ApiError => createApiError({
  status: 404,
  code: 'invitation.invitee_not_registered',
  message: 'No registered user has this email',
});

/**
 * The person invited is already a member (OQ-109).
 *
 * @returns 409 `invitation.already_member`.
 */
export const alreadyMember = (): ApiError => createApiError({
  status: 409, code: 'invitation.already_member', message: 'Already a member',
});

/**
 * The person invited already has a pending invitation to this household (OQ-109).
 *
 * @returns 409 `invitation.already_pending`.
 */
export const alreadyPending = (): ApiError => createApiError({
  status: 409, code: 'invitation.already_pending', message: 'Invitation already pending',
});

/**
 * The invitation was accepted, declined or revoked already (FR-1.10).
 *
 * @returns 409 `invitation.not_pending`.
 */
export const invitationNotPending = (): ApiError => createApiError({
  status: 409, code: 'invitation.not_pending', message: 'Invitation is no longer pending',
});
