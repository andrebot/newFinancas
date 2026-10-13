import type { Context, MiddlewareHandler } from 'hono';
import type { SystemRole } from '../db/schema/values';
import type { AccessTokenClaims } from '../utilities/authentication';
import { hasSystemRole } from '../utilities/authorization';
import { createApiError } from './apiError';
import type { AppEnv } from './errorHandler';

// Request authentication (OQ-30, OQ-111): every protected route requires a valid
// access token (`Authorization: Bearer <token>`) and a system role — USER for the
// app's APIs, ADMIN for the future sys-admin pages. The verified claims become the
// request's actor.

/** Verifies an access token (AuthenticationUtility.verifyAccessToken). */
export type VerifyAccessToken = (token: string) => Promise<AccessTokenClaims | undefined>;

const BEARER = /^Bearer (\S+)$/;

/**
 * Reads the bearer token from the Authorization header.
 *
 * @param header - The header's value, if any.
 * @returns The token, or `undefined` when absent or malformed.
 */
export const bearerToken = (header: string | undefined): string | undefined => (
  header?.match(BEARER)?.[1]
);

/**
 * Builds the middleware that admits only signed-in users with a system role.
 *
 * @param verify - Access-token verification.
 * @param required - The system role the routes need (ADMIN includes USER).
 * @returns The middleware: 401 `auth.unauthenticated` without a valid token,
 *   403 `auth.forbidden` without the role.
 */
export const requireSystemRole = (
  verify: VerifyAccessToken,
  required: SystemRole,
): MiddlewareHandler<AppEnv> => async (c, next) => {
  const token = bearerToken(c.req.header('Authorization'));
  const claims = token === undefined ? undefined : await verify(token);
  if (!claims) {
    throw createApiError({
      status: 401, code: 'auth.unauthenticated', message: 'Missing or invalid access token',
    });
  }
  if (!hasSystemRole(claims.systemRole, required)) {
    throw createApiError({ status: 403, code: 'auth.forbidden', message: 'System role required' });
  }
  c.set('actor', claims);
  await next();
};

/**
 * The signed-in actor of a protected route.
 *
 * @param c - The request context.
 * @returns The verified claims.
 * @throws {Error} When the route was mounted without the authentication middleware.
 */
export const actorOf = (c: Context<AppEnv>): AccessTokenClaims => {
  const actor = c.get('actor');
  if (!actor) throw new Error('Route needs the authentication middleware');
  return actor;
};
