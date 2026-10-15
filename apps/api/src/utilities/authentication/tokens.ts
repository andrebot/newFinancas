import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { authentication } from '../../config/constants';
import { SYSTEM_ROLES, type SystemRole } from '../../db/schema/values';

// Tokens (OQ-30, OQ-100): a short-lived JWT access token, a five-minute MFA
// challenge JWT (OQ-145), a fifteen-minute MFA enrollment JWT (OQ-149), and
// opaque random tokens (refresh, password reset) stored only as hashes. Policy: config/constants.

const {
  accessToken, challengeToken, enrollmentToken, opaqueTokenBytes,
} = authentication;

/** Who an access token speaks for, from which session (device), with which platform role. */
export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
  /** Carried in the token so no request reads it from the database (OQ-111). */
  readonly systemRole: SystemRole;
}

/**
 * Tells whether a claim value is a known system role.
 *
 * @param value - The `role` claim.
 * @returns Whether it is USER or ADMIN.
 */
const isSystemRole = (value: unknown): value is SystemRole => (
  (SYSTEM_ROLES as readonly unknown[]).includes(value)
);

/**
 * Signs an access token for a user's session. The session ID (`sid`) lets the
 * API tell the current device apart: logout, "sign out all others" (OQ-106).
 *
 * @param key - HS256 signing key.
 * @param claims - User (subject), session and system role.
 * @param now - Issue time.
 * @returns The compact JWT.
 */
export const signAccessToken = (
  key: Uint8Array,
  claims: AccessTokenClaims,
  now: Date,
): Promise<string> => {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: claims.sessionId, role: claims.systemRole })
    .setProtectedHeader({ alg: accessToken.algorithm })
    .setSubject(claims.userId)
    .setIssuer(accessToken.issuer)
    .setAudience(accessToken.audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + accessToken.ttlSeconds)
    .sign(key);
};

/**
 * Verifies an access token.
 *
 * @param key - HS256 signing key.
 * @param token - The compact JWT from the `Authorization` header.
 * @param now - Current time.
 * @returns User, session and system role, or `undefined` for an invalid,
 *   expired or foreign token, or one missing a claim or with an unknown role.
 */
export const verifyAccessToken = async (
  key: Uint8Array,
  token: string,
  now: Date,
): Promise<AccessTokenClaims | undefined> => {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [accessToken.algorithm],
      issuer: accessToken.issuer,
      audience: accessToken.audience,
      currentDate: now,
    });
    const { sub: userId, sid: sessionId, role: systemRole } = payload;
    return typeof userId === 'string' && typeof sessionId === 'string' && isSystemRole(systemRole)
      ? { userId, sessionId, systemRole }
      : undefined;
  } catch {
    return undefined;
  }
};

/** Whom an MFA step token (challenge or enrollment) was issued to. */
export interface ChallengeClaims {
  readonly userId: string;
  /** The address used: the next step looks the user up, and counts failures, by it. */
  readonly email: string;
}

/** An enrollment token names the same things as a challenge token (OQ-149). */
export type EnrollmentClaims = ChallengeClaims;

/** Which MFA step a token opens: its own audience and lifetime. */
interface StepTokenPolicy {
  readonly audience: string;
  readonly ttlSeconds: number;
}

/**
 * Signs a token for one MFA step: proof the password matched, valid only for
 * that step's audience and for its lifetime.
 *
 * @param key - HS256 signing key.
 * @param claims - The user (subject) and their address.
 * @param now - Issue time.
 * @param policy - The step's audience and lifetime.
 * @returns The compact JWT.
 */
const signStepToken = (
  key: Uint8Array,
  claims: ChallengeClaims,
  now: Date,
  policy: StepTokenPolicy,
): Promise<string> => {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: accessToken.algorithm })
    .setSubject(claims.userId)
    .setIssuer(accessToken.issuer)
    .setAudience(policy.audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + policy.ttlSeconds)
    .sign(key);
};

/**
 * Verifies a token for one MFA step.
 *
 * @param key - HS256 signing key.
 * @param token - The compact JWT from the request body.
 * @param now - Current time.
 * @param audience - The step it must have been issued for.
 * @returns The user and address, or `undefined` for an invalid, expired or
 *   foreign token (any other step's, or an access token), or one missing a claim.
 */
const verifyStepToken = async (
  key: Uint8Array,
  token: string,
  now: Date,
  audience: string,
): Promise<ChallengeClaims | undefined> => {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [accessToken.algorithm],
      issuer: accessToken.issuer,
      audience,
      currentDate: now,
    });
    const { sub: userId, email } = payload;
    return typeof userId === 'string' && typeof email === 'string'
      ? { userId, email }
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Signs an MFA challenge token: proof the password matched, valid for five
 * minutes and only for the second step of sign-in (OQ-145).
 *
 * @param key - HS256 signing key.
 * @param claims - The user (subject) and the address they signed in with.
 * @param now - Issue time.
 * @returns The compact JWT.
 */
export const signChallengeToken = (
  key: Uint8Array,
  claims: ChallengeClaims,
  now: Date,
): Promise<string> => signStepToken(key, claims, now, challengeToken);

/**
 * Verifies an MFA challenge token.
 *
 * @param key - HS256 signing key.
 * @param token - The compact JWT from the request body.
 * @param now - Current time.
 * @returns The user and address, or `undefined` for an invalid, expired or
 *   foreign token (an access or enrollment token included), or one missing a claim.
 */
export const verifyChallengeToken = (
  key: Uint8Array,
  token: string,
  now: Date,
): Promise<ChallengeClaims | undefined> => (
  verifyStepToken(key, token, now, challengeToken.audience)
);

/**
 * Signs an MFA enrollment token: proof the password was just set or matched,
 * valid for fifteen minutes and only to confirm the enrollment (OQ-149).
 *
 * @param key - HS256 signing key.
 * @param claims - The user (subject) and their address.
 * @param now - Issue time.
 * @returns The compact JWT.
 */
export const signEnrollmentToken = (
  key: Uint8Array,
  claims: EnrollmentClaims,
  now: Date,
): Promise<string> => signStepToken(key, claims, now, enrollmentToken);

/**
 * Verifies an MFA enrollment token.
 *
 * @param key - HS256 signing key.
 * @param token - The compact JWT from the request body.
 * @param now - Current time.
 * @returns The user and address, or `undefined` for an invalid, expired or
 *   foreign token (an access or challenge token included), or one missing a claim.
 */
export const verifyEnrollmentToken = (
  key: Uint8Array,
  token: string,
  now: Date,
): Promise<EnrollmentClaims | undefined> => (
  verifyStepToken(key, token, now, enrollmentToken.audience)
);

/**
 * Hashes an opaque token for storage and lookup.
 *
 * @param token - The token.
 * @returns Hex SHA-256 (tokens are 256 random bits, so a fast hash is enough).
 */
export const hashOpaqueToken = (token: string): string => (
  createHash('sha256').update(token).digest('hex')
);

/**
 * Issues an opaque token: the caller gives `token` to the client once and
 * stores only `tokenHash`.
 *
 * @param randomBytes - Source of randomness.
 * @returns The token and its hash.
 */
export const issueOpaqueToken = (
  randomBytes: (size: number) => Buffer,
): { token: string; tokenHash: string } => {
  const token = randomBytes(opaqueTokenBytes).toString('base64url');
  return { token, tokenHash: hashOpaqueToken(token) };
};
