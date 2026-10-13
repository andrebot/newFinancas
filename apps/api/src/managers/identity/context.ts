import { actorLabel, createLogger, type Logger } from '@financas/logging';
import type { SessionAccessor } from '../../accessors/sessionAccessor';
import type { UserAccessor } from '../../accessors/userAccessor';
import { authentication } from '../../config/constants';
import type { AccessTokenClaims, AuthenticationUtility } from '../../utilities/authentication';

// What every IdentityManager use case shares: its dependencies (the tier below,
// injected so integration tests mock exactly that tier — BDT), the request it
// runs for, and a logger carrying that request's correlation ID and actor.

/** The components IdentityManager calls. */
export interface IdentityDeps {
  readonly users: UserAccessor;
  readonly sessions: SessionAccessor;
  readonly authentication: AuthenticationUtility;
  readonly now: () => Date;
}

/** The request a use case runs for: its correlation ID and, once signed in, its actor. */
export interface RequestContext {
  readonly correlationId: string;
  readonly actor?: AccessTokenClaims;
}

/** A signed-in request. */
export interface SignedInContext extends RequestContext {
  readonly actor: AccessTokenClaims;
}

/** What a client keeps after signing in or refreshing. */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * A logger for one use case run, labelled IdentityManager.
 *
 * @param context - The request.
 * @param userId - The acting user when known but not yet in the context (e.g. just signed in).
 * @returns The logger.
 */
export const loggerFor = (context: RequestContext, userId?: string): Logger => {
  const actorId = context.actor?.userId ?? userId;
  return createLogger({
    label: 'IdentityManager',
    correlationId: context.correlationId,
    actor: actorId ? actorLabel({ userId: actorId }) : actorLabel('unauthenticated'),
  });
};

/**
 * When a refresh token issued now stops working (30-day sliding expiry, OQ-30).
 *
 * @param now - Issue time.
 * @returns The expiry.
 */
export const refreshTokenExpiry = (now: Date): Date => (
  new Date(now.getTime() + authentication.refreshToken.ttlDays * 86_400_000)
);
