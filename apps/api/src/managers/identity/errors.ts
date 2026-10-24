import { authentication } from '../../config/constants';
import { createDomainError, type DomainError } from '../../utilities/domainError';

export { forbidden, householdNotFound } from '../access';

// IdentityManager's rejections. A Manager answers with the contract's code
// (OQ-114, OQ-202): choosing which code is part of its security decisions
// (enumeration avoidance, one answer for every login failure); the HTTP layer
// gives each code its status.

/**
 * A failed password step — unknown email or wrong password — gives this one
 * answer, so it never reveals which emails are registered (OQ-114, OQ-145).
 *
 * @returns `auth.invalid_credentials`.
 */
export const invalidCredentials = (): DomainError => createDomainError({
  code: 'auth.invalid_credentials', message: 'Invalid credentials',
});

/**
 * A wrong MFA or recovery code. Said plainly: whoever reaches this step already
 * proved the password, so naming the factor reveals nothing (OQ-145).
 *
 * @returns `auth.mfa_invalid`.
 */
export const mfaInvalid = (): DomainError => createDomainError({
  code: 'auth.mfa_invalid', message: 'Invalid MFA or recovery code',
});

/**
 * An MFA challenge token that is expired, forged, or names a user who is gone:
 * the client starts again from the password (OQ-145).
 *
 * @returns `auth.challenge_expired`.
 */
export const challengeExpired = (): DomainError => createDomainError({
  code: 'auth.challenge_expired', message: 'Sign-in challenge expired',
});

/**
 * An MFA enrollment token that is expired or forged, names a user who is gone,
 * or whose enrollment is already confirmed: the client signs in again, which
 * answers a fresh enrollment while it is unconfirmed (OQ-149).
 *
 * @returns `auth.enrollment_expired`.
 */
export const enrollmentExpired = (): DomainError => createDomainError({
  code: 'auth.enrollment_expired', message: 'MFA enrollment expired',
});

/**
 * An address locked after too many failed logins (OQ-114).
 *
 * @param lockedUntil - When it unlocks.
 * @param now - Current time.
 * @returns `auth.too_many_attempts` with the wait, in minutes and in seconds.
 */
export const tooManyAttempts = (lockedUntil: Date, now: Date): DomainError => {
  const seconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
  return createDomainError({
    code: 'auth.too_many_attempts',
    message: 'Too many failed login attempts',
    params: { retryAfterMinutes: Math.ceil(seconds / 60) },
    retryAfterSeconds: seconds,
  });
};

/**
 * A refresh token that is unknown, expired, revoked or already used.
 *
 * @returns `auth.refresh_invalid`.
 */
export const refreshInvalid = (): DomainError => createDomainError({
  code: 'auth.refresh_invalid', message: 'Refresh token is not valid',
});

/**
 * A password shorter than the minimum (FR-1.1).
 *
 * @returns `password.too_short` with `min`.
 */
export const passwordTooShort = (): DomainError => createDomainError({
  code: 'password.too_short',
  message: 'Password is too short',
  params: { min: authentication.password.minLength },
});

/**
 * Registering an email that already has an account.
 *
 * @returns `user.email_taken`.
 */
export const emailTaken = (): DomainError => createDomainError({
  code: 'user.email_taken', message: 'Email already registered',
});

/**
 * A session that doesn't exist or isn't the caller's (one answer for both, OQ-106).
 *
 * @returns `session.not_found`.
 */
export const sessionNotFound = (): DomainError => createDomainError({
  code: 'session.not_found', message: 'Session not found',
});

/**
 * A signed-in user typed the wrong current password: a field's refusal, not an
 * authentication one, which would make the web app treat the session as
 * expired and sign the user out (OQ-115).
 *
 * @returns `password.current_incorrect`.
 */
export const currentPasswordIncorrect = (): DomainError => createDomainError({
  code: 'password.current_incorrect', message: 'Current password is incorrect',
});

/**
 * A reset link that is unknown, expired or already used (FR-1.13).
 *
 * @returns `password_reset.token_invalid`.
 */
export const resetTokenInvalid = (): DomainError => createDomainError({
  code: 'password_reset.token_invalid', message: 'Reset token is not valid',
});

/**
 * The signed-in account no longer exists.
 *
 * @returns `auth.unauthenticated`.
 */
export const unauthenticated = (): DomainError => createDomainError({
  code: 'auth.unauthenticated', message: 'Account no longer exists',
});

/**
 * The person acted on isn't a member of the household.
 *
 * @returns `household.member_not_found`.
 */
export const memberNotFound = (): DomainError => createDomainError({
  code: 'household.member_not_found', message: 'Not a member of this household',
});

/**
 * The membership changed while the request ran, and retrying didn't settle it
 * (OQ-107).
 *
 * @returns `household.changed`.
 */
export const householdChanged = (): DomainError => createDomainError({
  code: 'household.changed', message: 'Household membership changed concurrently',
});

/**
 * No invitation with that id in that household, or not the caller's to answer —
 * the same answer for both, so it never confirms one exists (OQ-118).
 *
 * @returns `invitation.not_found`.
 */
export const invitationNotFound = (): DomainError => createDomainError({
  code: 'invitation.not_found', message: 'Invitation not found',
});

/**
 * Invitations only reach registered users (FR-1.19, OQ-26).
 *
 * @returns `invitation.invitee_not_registered`.
 */
export const inviteeNotRegistered = (): DomainError => createDomainError({
  code: 'invitation.invitee_not_registered',
  message: 'No registered user has this email',
});

/**
 * The person invited is already a member (OQ-109).
 *
 * @returns `invitation.already_member`.
 */
export const alreadyMember = (): DomainError => createDomainError({
  code: 'invitation.already_member', message: 'Already a member',
});

/**
 * The person invited already has a pending invitation to this household (OQ-109).
 *
 * @returns `invitation.already_pending`.
 */
export const alreadyPending = (): DomainError => createDomainError({
  code: 'invitation.already_pending', message: 'Invitation already pending',
});

/**
 * The invitation was accepted, declined or revoked already (FR-1.10).
 *
 * @returns `invitation.not_pending`.
 */
export const invitationNotPending = (): DomainError => createDomainError({
  code: 'invitation.not_pending', message: 'Invitation is no longer pending',
});
