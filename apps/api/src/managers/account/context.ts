import { actorLabel, createLogger, type Logger } from '@financas/logging';
import type { AccountAccessor } from '../../accessors/accountAccessor';
import type { BudgetAccessor } from '../../accessors/budgetAccessor';
import type { CategoryAccessor } from '../../accessors/categoryAccessor';
import type { CreditCardAccessor } from '../../accessors/creditCardAccessor';
import { calendar } from '../../config/constants';
import type { AuthorizationUtility } from '../../utilities/authorization';
import calendarDate from '../../utilities/calendar';
import type { InTransaction } from '../../utilities/unitOfWork';
import type { SignedInContext } from '../requestContext';

// What every AccountManager use case shares: its dependencies (the tier below,
// injected so integration tests mock exactly that tier — BDT) and a logger
// carrying the request's correlation ID and actor. AccountManager owns what a
// user sets up ahead of any cash-flow event (VBD §2.1); the Accessors join it
// part by part (OQ-174).

/** The Accessors AccountManager calls; `inTransaction` hands work a set over one transaction. */
export interface AccountStores {
  readonly categories: CategoryAccessor;
  readonly accounts: AccountAccessor;
  readonly creditCards: CreditCardAccessor;
  readonly budgets: BudgetAccessor;
}

/** The components AccountManager calls, and the clock. */
export interface AccountDeps extends AccountStores {
  readonly authorization: Pick<AuthorizationUtility, 'authorize'>;
  /** Writes through several Accessors together or not at all (OQ-175). */
  readonly inTransaction: InTransaction<AccountStores>;
  readonly now: () => Date;
}

/**
 * Today in the app's time zone (OQ-104).
 *
 * @param deps - The clock.
 * @returns `YYYY-MM-DD`.
 */
export const todayOf = (deps: Pick<AccountDeps, 'now'>): string => (
  calendarDate(deps.now(), calendar.timeZone)
);

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
