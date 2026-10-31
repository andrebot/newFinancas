import { findKind, isFixedTerm, type TransactionKind } from '@financas/reference';
import type {
  AccountTransaction, ExpectedTransaction,
} from '../../accessors/accountTransactionAccessor';
import type {
  CardTransaction, ExpectedCardTransaction,
} from '../../accessors/cardTransactionAccessor';
import { validationFailed } from '../../utilities/domainError';
import type { SignedInContext } from '../requestContext';
import { requestLogger, type TransactionDeps, type TransactionStores } from './context';
import { holdingInUse, scheduleStarted, transactionChanged } from './errors';
import { restateHoldingValues } from '../holdingValues';
import inSequence from '../sequence';
import { inLockOrder } from './lockOrder';
import {
  assetTypeOf, loadEditable, loadPairSide, reverseAccountEffects, reverseCardEffects,
  scheduleLocked, tradeHoldingOf, type EditableRow, type RestoredPosition,
} from './reversal';

// Delete Transaction (CUC-3, FR-3.2/OQ-201 D7): the reverse-effect half of an
// edit — every stored effect is undone and the row goes with a guarded write,
// all in one transaction (OQ-175). The undo itself lives in reversal.ts,
// shared with Edit. A buy that created its Holding takes it with it when no
// other transaction references it; a fixed-term buy whose schedule has
// started is history now and stays.

/**
 * Undoes the Goal split this trade wrote — only while it is still the current
 * one (OQ-171): the write's rows were created in the same database transaction
 * as its row, so equal `createdAt` marks them; a later split owns the present
 * and stays.
 *
 * @param stores - The Accessors over one transaction.
 * @param holdingId - The Holding whose split it is.
 * @param createdAt - When this transaction was recorded.
 */
const undoSplit = async (
  stores: TransactionStores,
  holdingId: string,
  createdAt: Date,
): Promise<void> => {
  const current = await stores.goals.listAllocations({ holdingId });
  if (current.length === 0) return;
  const own = current.filter((share) => share.createdAt.getTime() === createdAt.getTime());
  if (own.length !== current.length) return; // a later split owns the present — leave it
  await stores.goals.deleteFrom(holdingId, own[0]!.validFrom);
  await stores.goals.reopenClosedAt(holdingId, own[0]!.validFrom);
};

/**
 * A buy whose undo zeros the position (OQ-201 D7): nothing else referencing it
 * deletes the Holding with it; a creator still referenced is refused — its rows
 * were written in the same transaction as the Holding, so equal `createdAt`
 * marks one; a re-buy just archives like any zeroed one (FR-5.8).
 */
const settleZeroedHolding = async (
  stores: TransactionStores,
  householdId: string,
  holdingId: string,
  transaction: AccountTransaction,
): Promise<void> => {
  const referencedBy = await stores.accountTransactions.countForHolding(holdingId, transaction.id);
  if (referencedBy === 0) {
    await stores.holdings.delete(holdingId);
    return;
  }
  const holding = await stores.holdings.findById(householdId, holdingId);
  const createdWithHolding = holding !== undefined
    && holding.createdAt.getTime() === transaction.createdAt.getTime();
  if (createdWithHolding) throw holdingInUse(referencedBy);
  await stores.holdings.archive(holdingId, 'system');
};

/** The trade's undo: its split comes back with the position. */
const undoTrade = async (
  stores: TransactionStores,
  householdId: string,
  row: EditableRow,
  restored: RestoredPosition,
): Promise<void> => {
  const transaction = row.transaction as AccountTransaction;
  if (restored.quantity === 0) {
    await settleZeroedHolding(stores, householdId, transaction.holdingId!, transaction);
    return;
  }
  // A zeroing sell's undo reopens a system archive in the shared reversal.
  await undoSplit(stores, transaction.holdingId!, transaction.createdAt);
};

/** The guarded delete — a concurrent edit is `stale` (OQ-203). */
const guardedDelete = async (stores: TransactionStores, row: EditableRow): Promise<void> => {
  if (row.ledger === 'card') {
    const transaction = row.transaction as CardTransaction;
    const expected: ExpectedCardTransaction = {
      date: transaction.date,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      subcategoryId: transaction.subcategoryId,
    };
    const deleted = await stores.cardTransactions.delete(transaction.id, expected);
    if (deleted === 'stale') throw transactionChanged();
    return;
  }
  const transaction = row.transaction as AccountTransaction;
  const expected: ExpectedTransaction = {
    date: transaction.date,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    subcategoryId: transaction.subcategoryId,
    trade: transaction.trade,
  };
  const deleted = await stores.accountTransactions.delete(transaction.id, expected);
  if (deleted === 'stale') throw transactionChanged();
};

/** Reverses every effect and deletes the row — all in the one transaction
 *  (OQ-175). The row goes first: a zeroed Holding's settlement counts its
 *  references without it, so nothing still points at the deleted row. */
const applyDelete = async (
  stores: TransactionStores,
  householdId: string,
  row: EditableRow,
  kind: TransactionKind,
): Promise<void> => {
  const restored = row.ledger === 'card'
    ? await reverseCardEffects(stores, row, kind)
    : await reverseAccountEffects(stores, row, kind);
  await guardedDelete(stores, row);
  if (restored !== undefined && row.ledger === 'account') {
    await undoTrade(stores, householdId, row, restored);
    // Its money leaves every later value too (OQ-222); a Holding deleted with
    // it has no history left to restate.
    await restateHoldingValues(stores, (row.transaction as AccountTransaction).holdingId!);
  }
};

/** A fixed-term buy whose schedule has started is history now and stays (OQ-201 D8). */
const checkDeletable = async (
  deps: TransactionDeps,
  householdId: string,
  row: EditableRow,
  kind: TransactionKind,
): Promise<void> => {
  if (kind.code !== 'investment_buy' || !isFixedTerm(assetTypeOf(row) ?? '')) return;
  const holding = await tradeHoldingOf(deps, householdId, row, kind);
  if (holding !== undefined && await scheduleLocked(deps, holding.id)) throw scheduleStarted();
};

/** Builds the Delete Transaction use case. */
const createDelete = (deps: TransactionDeps) => ({
  /**
   * Deletes a transaction from either ledger (CUC-3, FR-3.2): reverses every
   * stored effect and deletes the row in one guarded transaction — all or
   * nothing (OQ-175). A buy that created its Holding takes it with it when no
   * other transaction references it (`transaction.holding_in_use` otherwise);
   * a fixed-term buy whose schedule has started is refused. A transfer between
   * own accounts deletes both its sides (OQ-222).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param transactionId - The transaction on either ledger.
   * @throws {DomainError} `household.not_found` / `transaction.not_found`;
   *   `auth.forbidden`; `transaction.schedule_started`;
   *   `transaction.holding_in_use`; the trade's 409s; `transaction.changed`.
   */
  deleteTransaction: async (
    context: SignedInContext,
    householdId: string,
    transactionId: string,
  ): Promise<void> => {
    const row = await loadEditable(deps, context, householdId, transactionId, 'data.delete');
    const kind = findKind(row.transaction.kind);
    if (!kind) throw validationFailed([{ field: 'kind', code: 'field.invalid_option' }]);
    await checkDeletable(deps, householdId, row, kind);
    // A transfer between own accounts goes as one: both sides (OQ-222).
    const pair = await loadPairSide(deps, context, householdId, row);
    // Both sides in their Accounts' order, so opposite pairs never wait on each other.
    const sides = inLockOrder([row, ...(pair === undefined ? [] : [pair])]
      .map((side) => ({ side })));
    await deps.inTransaction<void>(async (stores) => {
      await inSequence(sides, ({ side }) => applyDelete(
        stores,
        householdId,
        side,
        findKind(side.transaction.kind)!,
      ));
    });
    requestLogger(context).audit('DeleteTransaction', {
      entityType: row.ledger === 'card' ? 'CardTransaction' : 'AccountTransaction',
      entityId: transactionId,
      householdId,
    });
  },
});

export default createDelete;
