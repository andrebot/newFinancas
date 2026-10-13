import { authentication } from '../../config/constants';
import type { IdentityDeps, RequestContext } from './context';
import { loggerFor } from './context';
import { emailTaken, passwordTooShort } from './errors';

// Create User (uc-11, FR-1.1/FR-1.15): registration enrols TOTP and issues the
// recovery codes in the same step — an account can't sign in without MFA.

/** What someone registers with. */
export interface Registration {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

/** What registration returns, once: the secret to scan and the recovery codes. */
export interface Registered {
  readonly userId: string;
  readonly totpSecret: string;
  readonly recoveryCodes: readonly string[];
}

/**
 * Builds the registration use case.
 *
 * @param deps - The tier below.
 * @returns `register`.
 */
const createRegistration = (deps: IdentityDeps) => ({
  /**
   * Registers a user with a hashed password, an encrypted TOTP secret and hashed
   * recovery codes. The plain secret and codes are returned once, never stored.
   *
   * @param context - The request.
   * @param input - Email, password and name; text is trimmed here (OQ-108).
   * @returns The new user's id, TOTP secret and recovery codes.
   * @throws {ApiError} 422 `password.too_short`; 409 `user.email_taken`.
   */
  register: async (context: RequestContext, input: Registration): Promise<Registered> => {
    if (input.password.length < authentication.password.minLength) throw passwordTooShort();
    const email = input.email.trim();
    const mfa = deps.authentication.enrollMfa(email);
    const result = await deps.users.insert({
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      passwordHash: await deps.authentication.hashPassword(input.password),
      encryptedMfaSecret: mfa.encryptedSecret,
      recoveryCodeHashes: mfa.recoveryCodeHashes,
    });
    if (!result.ok) throw emailTaken();
    const userId = result.user.id;
    loggerFor(context, userId)
      .audit('CreateUser', { entityType: 'User', entityId: userId, householdId: null });
    return { userId, totpSecret: mfa.secret, recoveryCodes: mfa.recoveryCodes };
  },
});

export default createRegistration;
