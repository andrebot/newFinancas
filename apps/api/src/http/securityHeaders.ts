import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { http } from '../config/constants';
import type { AppEnv } from './errorHandler';

// Security headers (N10 S1, OQ-250) on every response — the web app's pages
// and assets and every API answer, errors included: a strict CSP (the main
// defence for the refresh token kept in localStorage, OQ-124), HSTS, no
// framing, no referrer (the reset link carries its token), nosniff. Hono's
// secureHeaders adds its own defaults on top; the values are in config.

const { securityHeaders } = http;

/**
 * Copies config's read-only lists into the mutable arrays secureHeaders takes.
 *
 * @param lists - Directive name → its sources.
 * @returns The same lists, as mutable arrays.
 */
export const mutableLists = <Lists extends Record<string, readonly string[]>>(
  lists: Lists,
): { [Name in keyof Lists]: string[] } => Object.fromEntries(
  Object.entries(lists).map(([name, sources]) => [name, [...sources]]),
) as { [Name in keyof Lists]: string[] };

/**
 * Creates the middleware that sets the security headers.
 *
 * @returns Middleware adding the headers to every response.
 */
const createSecurityHeaders = (): MiddlewareHandler<AppEnv> => secureHeaders({
  contentSecurityPolicy: mutableLists(securityHeaders.contentSecurityPolicy),
  strictTransportSecurity: securityHeaders.strictTransportSecurity,
  xFrameOptions: securityHeaders.xFrameOptions,
  permissionsPolicy: mutableLists(securityHeaders.permissionsPolicy),
});

export default createSecurityHeaders;
