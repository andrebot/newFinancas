import { randomBytes as cryptoRandomBytes } from 'node:crypto';
import {
  currentTotp, enrollMfa, hashRecoveryCode, verifyRecoveryCode, verifyTotp,
} from './mfa';
import { hashPassword, verifyPassword } from './passwords';
import {
  IV_BYTES, openSecret, parseEncryptionKey, sealSecret,
} from './secretBox';
import {
  hashOpaqueToken, issueOpaqueToken, signAccessToken, signChallengeToken, signEnrollmentToken,
  verifyAccessToken, verifyChallengeToken, verifyEnrollmentToken,
  type AccessTokenClaims, type ChallengeClaims, type EnrollmentClaims,
} from './tokens';

export type { AccessTokenClaims, ChallengeClaims, EnrollmentClaims } from './tokens';

// AuthenticationUtility (U4, VBD): pure identity-proof primitives — passwords,
// MFA, tokens. Touches no storage; Managers persist what it returns (OQ-100).

/** Secrets from configuration. */
export interface AuthenticationConfig {
  /** HS256 key for access tokens (at least 32 characters). */
  readonly jwtSecret: string;
  /** Base64 32-byte key encrypting TOTP secrets at rest (NFR-SEC-3). */
  readonly mfaEncryptionKey: string;
}

/** Clock and randomness, injectable so tests are deterministic. */
export interface AuthenticationDeps {
  readonly now: () => Date;
  readonly randomBytes: (size: number) => Buffer;
}

const DEFAULT_DEPS: AuthenticationDeps = { now: () => new Date(), randomBytes: cryptoRandomBytes };

/**
 * Builds the authentication utility bound to its secrets.
 *
 * @param config - Signing and encryption keys.
 * @param deps - Clock and randomness.
 * @returns The utility's operations.
 * @throws {Error} When the encryption key is not 32 bytes.
 */
export const createAuthenticationUtility = (
  config: AuthenticationConfig,
  deps: AuthenticationDeps = DEFAULT_DEPS,
) => {
  const signingKey = new TextEncoder().encode(config.jwtSecret);
  const encryptionKey = parseEncryptionKey(config.mfaEncryptionKey);
  const decrypt = (encryptedSecret: string) => openSecret(encryptionKey, encryptedSecret);

  return {
    hashPassword,
    verifyPassword,
    /**
     * Enrols MFA: the plain secret and codes are shown to the user once; store
     * `encryptedSecret` and `recoveryCodeHashes`.
     *
     * @param accountLabel - The user's email, shown in the authenticator app.
     * @returns The enrolment plus the encrypted secret.
     */
    enrollMfa: (accountLabel: string) => {
      const enrolment = enrollMfa(accountLabel, deps.randomBytes);
      const iv = deps.randomBytes(IV_BYTES);
      const encryptedSecret = sealSecret(encryptionKey, enrolment.secret, iv);
      return { ...enrolment, encryptedSecret };
    },
    /**
     * Encrypts a known TOTP secret for storage — for fixed dev credentials (the
     * demo seed); real users get theirs from `enrollMfa`.
     *
     * @param secret - Base32 TOTP secret.
     * @returns The sealed secret, as `enrollMfa`'s `encryptedSecret`.
     */
    sealMfaSecret: (secret: string): string => (
      sealSecret(encryptionKey, secret, deps.randomBytes(IV_BYTES))
    ),
    /**
     * Checks a TOTP code against a stored (encrypted) secret. A secret that won't
     * decrypt means a configuration error and throws, rather than failing quietly.
     *
     * @param encryptedSecret - As stored.
     * @param code - The code typed by the user.
     * @returns `true` when valid now.
     */
    verifyTotp: (encryptedSecret: string, code: string) => (
      verifyTotp(decrypt(encryptedSecret), code, deps.now())
    ),
    /**
     * The current code for a stored secret — for E2E tests and the demo seed only.
     *
     * @param encryptedSecret - As stored.
     * @returns The 6-digit code.
     */
    currentTotp: (encryptedSecret: string) => currentTotp(decrypt(encryptedSecret), deps.now()),
    hashRecoveryCode,
    verifyRecoveryCode,
    /**
     * Signs a 15-minute access token for a user's session.
     *
     * @param claims - The authenticated user and their session.
     * @returns The JWT.
     */
    signAccessToken: (claims: AccessTokenClaims) => signAccessToken(signingKey, claims, deps.now()),
    /**
     * Verifies an access token.
     *
     * @param token - The JWT.
     * @returns User and session, or `undefined` when not valid.
     */
    verifyAccessToken: (token: string) => verifyAccessToken(signingKey, token, deps.now()),
    /**
     * Signs a five-minute MFA challenge token for a user whose password matched (OQ-145).
     *
     * @param claims - The user and the address they signed in with.
     * @returns The JWT.
     */
    signChallengeToken: (claims: ChallengeClaims) => (
      signChallengeToken(signingKey, claims, deps.now())
    ),
    /**
     * Verifies an MFA challenge token.
     *
     * @param token - The JWT.
     * @returns User and address, or `undefined` when not valid.
     */
    verifyChallengeToken: (token: string) => verifyChallengeToken(signingKey, token, deps.now()),
    /**
     * Signs a fifteen-minute MFA enrollment token for a user whose enrollment
     * still needs its first code (OQ-149).
     *
     * @param claims - The user and their address.
     * @returns The JWT.
     */
    signEnrollmentToken: (claims: EnrollmentClaims) => (
      signEnrollmentToken(signingKey, claims, deps.now())
    ),
    /**
     * Verifies an MFA enrollment token.
     *
     * @param token - The JWT.
     * @returns User and address, or `undefined` when not valid.
     */
    verifyEnrollmentToken: (token: string) => (
      verifyEnrollmentToken(signingKey, token, deps.now())
    ),
    /**
     * Issues a refresh or password-reset token.
     *
     * @returns The token (give to the client once) and its hash (store).
     */
    issueOpaqueToken: () => issueOpaqueToken(deps.randomBytes),
    hashOpaqueToken,
  };
};

/** The authentication utility's operations, as injected into Managers. */
export type AuthenticationUtility = ReturnType<typeof createAuthenticationUtility>;
