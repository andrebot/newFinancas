import { actorLabel, createLogger, type Logger } from '@financas/logging';
import type { AccountAccessor } from '../../accessors/accountAccessor';
import type { AccountTransactionAccessor } from '../../accessors/accountTransactionAccessor';
import type { BudgetAccessor } from '../../accessors/budgetAccessor';
import type { CardTransactionAccessor } from '../../accessors/cardTransactionAccessor';
import type { CategoryAccessor } from '../../accessors/categoryAccessor';
import type { CreditCardAccessor } from '../../accessors/creditCardAccessor';
import type { GoalAccessor } from '../../accessors/goalAccessor';
import type { InvestmentHoldingAccessor } from '../../accessors/investmentHoldingAccessor';
import type { ValuationSnapshotAccessor } from '../../accessors/valuationSnapshotAccessor';
import { calendar } from '../../config/constants';
import type { InvestmentProductEngine } from '../../engines/investmentProduct';
import type { AuthorizationUtility } from '../../utilities/authorization';
import calendarDate from '../../utilities/calendar';
import type { InTransaction } from '../../utilities/unitOfWork';
import type { SignedInContext } from '../requestContext';

// What every TransactionManager use case shares: its dependencies (the tier
// below, injected so integration tests mock exactly that tier — BDT) and a
// logger carrying the request's correlation ID and actor. TransactionManager
// owns every cash-flow event of the household (VBD §2.1/§3.1): it decides which
// side effect applies and what its parameters are; each Accessor executes one
// validated write, and InvestmentProductEngine is the one Engine it calls — a
// fixed-term buy's schedule.

/** The Accessors TransactionManager writes through; `inTransaction` hands work a set over one
 * transaction (OQ-175). */
export interface TransactionStores {
  readonly accounts: AccountAccessor;
  readonly accountTransactions: AccountTransactionAccessor;
  readonly cardTransactions: CardTransactionAccessor;
  readonly creditCards: CreditCardAccessor;
  readonly categories: CategoryAccessor;
  readonly budgets: BudgetAccessor;
  readonly goals: GoalAccessor;
  readonly holdings: InvestmentHoldingAccessor;
  readonly valuations: ValuationSnapshotAccessor;
}

/** The components TransactionManager calls, and the clock. */
export interface TransactionDeps extends TransactionStores {
  /** A fixed-term contract's cash events (VBD §2.2) — reads its index value itself. */
  readonly investmentProducts: Pick<InvestmentProductEngine, 'schedule'>;
  readonly authorization: Pick<AuthorizationUtility, 'authorize'>;
  /** Writes through several Accessors together or not at all (OQ-175). */
  readonly inTransaction: InTransaction<TransactionStores>;
  readonly now: () => Date;
}

/**
 * Today in the app's time zone (OQ-104) — a split that takes effect "today".
 *
 * @param deps - The clock.
 * @returns `YYYY-MM-DD`.
 */
export const todayOf = (deps: Pick<TransactionDeps, 'now'>): string => (
  calendarDate(deps.now(), calendar.timeZone)
);

/**
 * A logger for one use case run, labelled TransactionManager.
 *
 * @param correlationId - The request's (or the bus message's) correlation ID.
 * @param userId - The acting user; none for a schedule post the system handles.
 * @returns The logger.
 */
export const loggerFor = (correlationId: string, userId?: string): Logger => createLogger({
  label: 'TransactionManager',
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
