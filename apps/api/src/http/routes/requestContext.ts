import type { Context } from 'hono';
import type { RequestContext, SignedInContext } from '../../managers/identity';
import { actorOf } from '../authentication';
import { correlationIdOf, type AppEnv } from '../errorHandler';

// The request a Manager use case runs for, read from the HTTP context.

/**
 * The request of a public route (no one is signed in yet).
 *
 * @param httpContext - The request context.
 * @returns Its correlation ID.
 */
export const publicContextOf = (httpContext: Context<AppEnv>): RequestContext => ({
  correlationId: correlationIdOf(httpContext),
});

/**
 * The request of a protected route.
 *
 * @param httpContext - The request context.
 * @returns Its correlation ID and signed-in actor.
 */
export const signedInContextOf = (httpContext: Context<AppEnv>): SignedInContext => ({
  correlationId: correlationIdOf(httpContext), actor: actorOf(httpContext),
});
