import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { authentication } from '../../config/constants';
import { SYSTEM_ROLES, type SystemRole } from '../../db/schema/values';

// Tokens (OQ-30, OQ-100): a short-lived JWT access token, and opaque random
// tokens (refresh, password reset) stored only as hashes. Policy: config/constants.

const { accessToken, opaqueTokenBytes } = authentication;

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
