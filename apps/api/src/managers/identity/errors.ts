import { authentication } from '../../config/constants';
import { createApiError, type ApiError } from '../../http/apiError';

// IdentityManager's rejections. A Manager answers with the contract's code and
// status itself (OQ-114): choosing 401 vs 404 vs 409 here is part of its
// security decisions (enumeration avoidance, one answer for every login failure).

/**
 * Any login failure — unknown email, wrong password or wrong MFA code — gives
 * this one answer, so it never reveals which factor failed (OQ-114).
 *
 * @returns 401 `auth.invalid_credentials`.
 */
export const invalidCredentials = (): ApiError => createApiError({
  status: 401, code: 'auth.invalid_credentials', message: 'Invalid credentials',
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
