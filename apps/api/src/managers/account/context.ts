import { actorLabel, createLogger, type Logger } from '@financas/logging';
import type { CategoryAccessor } from '../../accessors/categoryAccessor';
import type { AuthorizationUtility } from '../../utilities/authorization';
import type { SignedInContext } from '../requestContext';

// What every AccountManager use case shares: its dependencies (the tier below,
// injected so integration tests mock exactly that tier — BDT) and a logger
// carrying the request's correlation ID and actor. AccountManager owns what a
// user sets up ahead of any cash-flow event (VBD §2.1); the Accessors join it
// part by part (OQ-174).

/** The components AccountManager calls. */
export interface AccountDeps {
  readonly categories: CategoryAccessor;
  readonly authorization: Pick<AuthorizationUtility, 'authorize'>;
}

/**
 * A logger for one use case run, labelled AccountManager.
 *
 * @param correlationId - The request's (or the bus message's) correlation ID.
 * @param userId - The acting user; none for a bus event the system handles.
 * @returns The logger.
 */
export const loggerFor = (correlationId: string, userId?: string): Logger => createLogger({
  label: 'AccountManager',
  correlationId,
  actor: userId ? actorLabel({ userId }) : actorLabel('system'),
});

/**
 * The logger of a signed-in request.
 *
 * @param context - The request.
 * @returns The logger, with its correlation ID and actor.
 */
export const requestLogger = (context: SignedInContext): Logger => (
  loggerFor(context.correlationId, context.actor.userId)
);
