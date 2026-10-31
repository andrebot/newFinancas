import type { TransactionKind } from '@financas/reference';
import type { Account } from '../../accessors/accountAccessor';
import type { AccountTransaction, TradeDeltas } from '../../accessors/accountTransactionAccessor';
import type { CardTransaction } from '../../accessors/cardTransactionAccessor';
import type { InvestmentHolding } from '../../accessors/investmentHoldingAccessor';
import {
  accessToOwned, forbidden, memberOnly, requireAccess,
} from '../access';
import type { SignedInContext } from '../requestContext';
import type { AccessRequest, DataAction } from '../../utilities/authorization';
import {
  type TransactionDeps, type TransactionStores,
} from './context';
import {
  accountMovementOf, accrueBudget, budgetAccrualOf, cardMovementOf,
} from './effects';
import {
  accountArchived, tradeRefusal, holdingNotFound, transactionChanged, transactionNotFound,
} from './errors';
import requirePaidCard from './paidCard';

// The "undo a stored row" half that Edit and Delete share: loading the row
// with its effects' context, reversing those effects (cash leg, trade deltas,
// Budget accrual) and restoring the position. Both callers get the same
// behaviour by construction — a reversal unarchives a system-archived Holding
// it reopens (OQ-171) and tolerates a bill payment whose card is gone
// (`credit_card_id` is ON DELETE SET NULL).

/** A loaded transaction with what its effects need. */
export interface EditableRow {
  readonly ledger: 'account' | 'card';
  readonly transaction: AccountTransaction | CardTransaction;
  /** The Account the movement and accrual act on (bill payment: its own). */
  readonly account: Account;
  /** Card rows and bill payments. */
  readonly creditCardId?: string;
  /** Trades only — the stored quantity, positive units. */
  readonly storedQuantity?: number;
}

/** The position a trade's reversal restores (OQ-171). */
export interface RestoredPosition {
  readonly quantity: number;
  readonly costBasis: number;
}

/** The kinds that move the Holding's position — dividends and friends don't (OQ-171). */
const TRADE_KINDS = new Set(['investment_buy', 'investment_sell', 'investment_redemption']);

/** Whether a kind carries trade deltas on its row. */
export const movesPosition = (kind: TransactionKind): boolean => TRADE_KINDS.has(kind.code);

/** The asset type a trade's Holding carries — none on the card ledger. */
export const assetTypeOf = (row: EditableRow): string | undefined => (
  row.ledger === 'account' ? (row.transaction as AccountTransaction).holding?.assetType : undefined
);

/** How an edit or delete asks for access on the row's Account, once loaded. */
type RowAccess = (account: Account | undefined) => AccessRequest;

/**
 * The access an edit or delete of a recorded row asks for (OQ-111, OQ-223): on
 * a shared Account the row belongs to who recorded it — a Member manages their
 * own entries, not another's, and a schedule post (no recorder) is an Owner's
 * or Admin's; a personal Account stays its owner's, whoever recorded on it.
 *
 * @param recorder - Who recorded the row; none for a schedule post.
 * @param action - `data.edit` or `data.delete`.
 * @returns The request, given the row's Account (if found).
 */
export const accessToRecorded = (recorder: string | null, action: DataAction): RowAccess => (
  (account) => (account?.visibility === 'shared'
    ? { action, visibility: 'shared', ownerUserId: recorder }
    : accessToOwned(account, action))
);

/**
 * The Account-ledger half of the load: its Account must be open — archiving is
 * one-way and freezes its history (FR-2.4, OQ-220) — and a bill payment's
 * card's Account is decided on too, with the same request, and must be open:
 * editing or deleting the payment moves the card's balance (OQ-219, OQ-223).
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param transaction - The row.
 * @param access - The access it asks for on its Account (and a paid card's).
 * @param notVisible - The not-found for an Account the caller may not see.
 * @returns The row with its effects' context.
 * @throws {DomainError} `household.not_found` / `notVisible()`; `auth.forbidden`;
 *   `transaction.not_found`; `account.archived`; the paid card's refusals.
 */
const loadAccountRow = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  transaction: AccountTransaction,
  access: RowAccess,
  notVisible: typeof transactionNotFound = transactionNotFound,
): Promise<EditableRow> => {
  const account = await deps.accounts.findById(householdId, transaction.accountId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    access(account),
    notVisible,
  );
  if (!account) throw transactionNotFound();
  if (account.archivedAt !== null) throw accountArchived();
  if (transaction.creditCardId) {
    await requirePaidCard(deps, context, householdId, transaction.creditCardId, access);
  }
  return {
    ledger: 'account',
    transaction,
    account,
    ...(transaction.creditCardId && { creditCardId: transaction.creditCardId }),
    ...(transaction.trade && { storedQuantity: Math.abs(transaction.trade.quantityDelta) }),
  };
};

/**
 * The card-ledger half of the load: access is decided on the card's Account
 * and the row's recorder, and that Account must be open (FR-2.4, OQ-220).
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param transaction - The card row.
 * @param action - `data.edit` or `data.delete`.
 * @returns The row with its effects' context.
 * @throws {DomainError} `household.not_found` / `transaction.not_found`;
 *   `auth.forbidden`; `account.archived`.
 */
const loadCardRow = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  transaction: CardTransaction,
  action: DataAction,
): Promise<EditableRow> => {
  const card = await deps.creditCards.findById(householdId, transaction.creditCardId);
  const account = card && await deps.accounts.findById(householdId, card.accountId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    accessToRecorded(transaction.createdByUserId, action)(account),
    transactionNotFound,
  );
  if (!card || !account) throw transactionNotFound();
  if (account.archivedAt !== null) throw accountArchived();
  return {
    ledger: 'card', transaction, account, creditCardId: transaction.creditCardId,
  };
};

/**
 * Loads a transaction from either ledger, deciding access on its Account and
 * its recorder. A row that isn't there asks only the membership check, so a
 * non-member still learns nothing (OQ-117).
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param transactionId - The row, on either ledger.
 * @param action - `data.edit` or `data.delete`.
 * @returns The row with its effects' context.
 * @throws {DomainError} `household.not_found` / `transaction.not_found`;
 *   `auth.forbidden`; `account.archived`; the paid card's refusals.
 */
export const loadEditable = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  transactionId: string,
  action: DataAction,
): Promise<EditableRow> => {
  const accountRow = await deps.accountTransactions.findById(householdId, transactionId);
  if (accountRow) {
    const access = accessToRecorded(accountRow.createdByUserId, action);
    return loadAccountRow(deps, context, householdId, accountRow, access);
  }
  const cardRow = await deps.cardTransactions.findById(householdId, transactionId);
  if (cardRow) return loadCardRow(deps, context, householdId, cardRow, action);
  await requireAccess(deps.authorization, context.actor.userId, householdId, memberOnly);
  throw transactionNotFound();
};

/**
 * Loads the other side of a transfer between own accounts (OQ-222): the pair
 * edits and deletes as one, so the other side is decided on as the row was —
 * its recorder's on a shared Account, its owner's on a personal one (OQ-223):
 * making one's own side personal never hands over the other — and one they
 * can't see is `auth.forbidden`, not a not-found, since they see the row they
 * asked for.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param row - The side asked for.
 * @param action - `data.edit` or `data.delete`.
 * @returns The other side, or `undefined` for a row that isn't one side of a pair.
 * @throws {DomainError} `auth.forbidden`; `account.archived`; `transaction.not_found`
 *   when the other side went meanwhile.
 */
export const loadPairSide = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  row: EditableRow,
  action: DataAction,
): Promise<EditableRow | undefined> => {
  const pair = row.ledger === 'account' ? (row.transaction as AccountTransaction).pair : null;
  if (pair === null) return undefined;
  const other = await deps.accountTransactions.findById(householdId, pair.id);
  if (!other) throw transactionNotFound();
  const access = accessToRecorded(row.transaction.createdByUserId, action);
  return loadAccountRow(deps, context, householdId, other, access, forbidden);
};

/** Whether a fixed-term buy's schedule has posted — its terms are locked (OQ-201 D8). */
export const scheduleLocked = async (
  deps: TransactionDeps,
  holdingId: string,
): Promise<boolean> => {
  const entries = await deps.holdings.listSchedule([holdingId]);
  return entries.some((entry) => entry.postedAt !== null);
};

/** Reverses a trade's position deltas and returns the restored position. */
const reverseTrade = async (
  stores: TransactionStores,
  holdingId: string | null,
  trade: TradeDeltas,
): Promise<RestoredPosition> => {
  const reversed = await stores.holdings.applyTrade(holdingId!, {
    quantityDelta: -trade.quantityDelta, costBasisDelta: -trade.costBasisDelta,
  });
  if (!reversed.ok) throw tradeRefusal(reversed.reason);
  return { quantity: reversed.quantity, costBasis: reversed.costBasis };
};

/** The accrual that undoes one — the Budget counts it back. */
const negateAccrual = (
  accrual: ReturnType<typeof budgetAccrualOf>,
): Parameters<typeof accrueBudget>[1] => {
  if (accrual === null) return null;
  return { ...accrual, amount: -accrual.amount };
};

/** Reverses the stored effects of an account-ledger transaction. A trade that
 *  reopens a zeroed position unarchives its system archive (OQ-171); a bill
 *  payment whose card is gone reverses only its cash leg and accrual. */
export const reverseAccountEffects = async (
  stores: TransactionStores,
  row: EditableRow,
  kind: TransactionKind,
): Promise<RestoredPosition | undefined> => {
  const transaction = row.transaction as AccountTransaction;
  const oldValues = {
    amount: transaction.amount, currency: transaction.currency, date: transaction.date,
  };
  const movement = accountMovementOf(kind, oldValues);
  const moved = await stores.accounts.applyMovement(
    row.account.id,
    { ...movement, amount: -movement.amount },
  );
  if (!moved.ok) throw transactionChanged();
  let restored: RestoredPosition | undefined;
  if (movesPosition(kind)) {
    restored = await reverseTrade(stores, transaction.holdingId, transaction.trade!);
    // A zeroing sell's undo reopens a system archive (OQ-171); user archives stay.
    if (restored.quantity > 0) {
      await stores.holdings.unarchiveIfSystemArchived(transaction.holdingId!);
    }
  } else if (kind.code === 'credit_card_bill_payment' && row.creditCardId) {
    // The payment lowered the outstanding balance; undoing it raises it.
    const paid = await stores.creditCards.applyMovement(row.creditCardId, {
      amount: transaction.amount, currency: transaction.currency, date: transaction.date,
    });
    if (!paid.ok) throw transactionChanged();
  }
  const accrual = budgetAccrualOf(
    row.account,
    kind,
    oldValues,
    transaction.categoryId,
    transaction.subcategoryId,
  );
  await accrueBudget(stores, negateAccrual(accrual));
  return restored;
};

/** Reverses the stored effects of a card-ledger transaction. */
export const reverseCardEffects = async (
  stores: TransactionStores,
  row: EditableRow,
  kind: TransactionKind,
): Promise<RestoredPosition | undefined> => {
  const transaction = row.transaction as CardTransaction;
  const oldValues = {
    amount: transaction.amount, currency: transaction.currency, date: transaction.date,
  };
  const movement = cardMovementOf(kind, oldValues);
  const moved = await stores.creditCards.applyMovement(
    row.creditCardId!,
    { ...movement, amount: -movement.amount },
  );
  if (!moved.ok) throw transactionChanged();
  const accrual = budgetAccrualOf(
    row.account,
    kind,
    oldValues,
    transaction.categoryId,
    transaction.subcategoryId,
  );
  await accrueBudget(stores, negateAccrual(accrual));
  return undefined;
};

/** The Holding a trade names — anything else is its own not-found. */
export const tradeHoldingOf = async (
  deps: TransactionDeps,
  householdId: string,
  row: EditableRow,
  kind: TransactionKind,
): Promise<InvestmentHolding | undefined> => {
  if (kind.effect !== 'investment_trade') return undefined;
  const holdingId = (row.transaction as AccountTransaction).holdingId!;
  const holding = await deps.holdings.findById(householdId, holdingId);
  if (!holding) throw holdingNotFound();
  return holding;
};
