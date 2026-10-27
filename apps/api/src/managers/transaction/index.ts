import type { ServiceBus } from '../../utilities/serviceBus';
import createBrowse from './browse';
import type { TransactionDeps } from './context';
import createDelete from './delete';
import createEdit from './edit';
import { createEventHandlers, type TransactionEventHandlers } from './events';
import createRecord from './record';

// TransactionManager (M3, VBD §3.1): every cash-flow event — typed by a user or
// posted by the schedule — through one pipeline: Record, then Edit and Delete
// as its inverse, and Browse & Filter over both ledgers. Each use case decides;
// the Accessors apply (OQ-107).

export type { TransactionDeps, TransactionStores } from './context';
export type { LoadedTarget, RecordedTransaction, TransactionCreate } from './record';
export type { EditedTransaction, TransactionEdit } from './edit';
export type { LedgerRow, TransactionListFilter, TransactionPage } from './browse';
export type { TransactionEventHandlers } from './events';
// What the use cases answer with, as the routes map them to JSON: the routes see
// the Manager's results, never an Accessor (code review A3, OQ-163).
export type { AccountTransaction, TradeDeltas } from '../../accessors/accountTransactionAccessor';
export type { CardTransaction } from '../../accessors/cardTransactionAccessor';

/**
 * Creates TransactionManager.
 *
 * @param deps - The Accessors and Utilities it calls, and the clock.
 * @returns Every TransactionManager use case, and its event handlers.
 */
export const createTransactionManager = (deps: TransactionDeps) => ({
  ...createRecord(deps),
  ...createEdit(deps),
  ...createDelete(deps),
  ...createBrowse(deps),
  ...createEventHandlers(deps),
});

export type TransactionManager = ReturnType<typeof createTransactionManager>;

/** Subscribes the Manager to its one event (VBD §3.2a). */
export const subscribeTransactionManager = (
  bus: Pick<ServiceBus, 'subscribe'>,
  handlers: TransactionEventHandlers,
): (() => void) => {
  const unsubscribe = bus.subscribe('transaction.import.requested', handlers.postScheduledEntry);
  return () => unsubscribe();
};
