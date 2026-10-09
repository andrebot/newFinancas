import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { authentication } from '../../config/constants';

// Tokens (OQ-30, OQ-100): a short-lived JWT access token, and opaque random
// tokens (refresh, password reset) stored only as hashes. Policy: config/constants.

const { accessToken, opaqueTokenBytes } = authentication;

/** Who an access token speaks for, and from which session (device). */
export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
}

/**
 * Signs an access token for a user's session. The session ID (`sid`) lets the
 * API tell the current device apart: logout, "sign out all others" (OQ-106).
 *
 * @param key - HS256 signing key.
 * @param claims - User (subject) and session.
 * @param now - Issue time.
 * @returns The compact JWT.
 */
export const signAccessToken = (
  key: Uint8Array,
  claims: AccessTokenClaims,
  now: Date,
): Promise<string> => {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: claims.sessionId })
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
 * @returns User and session, or `undefined` for an invalid, expired or foreign
 *   token, or one missing either claim.
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
    const { sub: userId, sid: sessionId } = payload;
    return typeof userId === 'string' && typeof sessionId === 'string'
      ? { userId, sessionId }
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
