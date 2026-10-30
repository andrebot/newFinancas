import { findKind, isFixedTerm, type TransactionKind } from '@financas/reference';
import type {
  AccountTransaction, ExpectedTransaction, TradeDeltas,
} from '../../accessors/accountTransactionAccessor';
import type {
  CardTransaction, ExpectedCardTransaction,
} from '../../accessors/cardTransactionAccessor';
import type {
  ExpectedHoldingTerms, HoldingTermChanges, InvestmentHolding,
} from '../../accessors/investmentHoldingAccessor';
import type { InterestPayment } from '../../db/schema/values';
import type { ContractTerms } from '../../engines/investmentProduct';
import { validationFailed } from '../../utilities/domainError';
import type { SignedInContext } from '../requestContext';
import { requireNoProblems } from '../validation';
import { requestLogger, type TransactionDeps, type TransactionStores } from './context';
import {
  accountMovementOf, accrueBudget, budgetAccrualOf, cardMovementOf, engineRateOf, holdingRateOf,
  type EffectValues, type RequestRate,
  valueAfterTrade, valueBefore,
} from './effects';
import { fixedTermProblems } from './kindRules';
import {
  categoryNotFound, holdingArchived, indexRateMissing, scheduleStarted, subcategoryMismatch,
  transactionChanged, tradeRefusal,
} from './errors';
import {
  assetTypeOf, loadEditable, movesPosition, scheduleLocked, reverseAccountEffects,
  reverseCardEffects, tradeHoldingOf, type EditableRow, type RestoredPosition,
} from './reversal';

// Edit Transaction (CUC-2, OQ-201 D6/D8): values only — kind and target never
// change. It reverses the stored effects, reapplies them with the new values
// and guarded-updates the row in one transaction; a concurrent write is a 409
// `transaction.changed` (OQ-203). A fixed-term buy whose schedule has started
// takes only category, subcategory and description.

/** The fields an edit may change (the contract's TransactionUpdateRequest). */
export interface TransactionEdit {
  readonly date?: string | undefined;
  readonly amount?: number | undefined;
  readonly categoryId?: string | null | undefined;
  readonly subcategoryId?: string | null | undefined;
  readonly description?: string | null | undefined;
  /** Buy, sell and redemption only — positive units. */
  readonly quantity?: number | undefined;
  /** Fixed-term buy terms only (OQ-201 D8). */
  readonly rate?: RequestRate | null | undefined;
  readonly dueDate?: string | undefined;
  readonly interestPayment?: InterestPayment | undefined;
  readonly incentivised?: boolean | undefined;
}

/** The values a transaction holds after an edit. */
interface MergedValues extends EffectValues {
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  readonly description: string | null;
  /** Trades only — positive units. */
  readonly quantity?: number;
  /** Fixed-term buy terms that change (OQ-201 D8). */
  readonly terms?: HoldingTermChanges;
}

/** What an edit returns to the route. */
export interface EditedTransaction {
  readonly ledger: 'account' | 'card';
  readonly transaction: AccountTransaction | CardTransaction;
}

const BASE_FIELDS = ['date', 'amount', 'categoryId', 'subcategoryId', 'description'] as const;
const TERM_FIELDS = ['rate', 'dueDate', 'interestPayment'];

/** The fields an edit of this kind may change (OQ-201 D6/D8). */
export const editableFieldsOf = (kind: TransactionKind, assetType?: string): Set<string> => {
  const fields: string[] = [...BASE_FIELDS];
  if (movesPosition(kind)) fields.push('quantity');
  if (kind.code === 'investment_buy' && isFixedTerm(assetType ?? '')) {
    fields.push(...TERM_FIELDS);
    if (assetType === 'debenture') fields.push('incentivised');
  }
  return new Set(fields);
};

/** Refuses keys this kind does not take (OQ-201 D6). */
const checkEditFields = (update: TransactionEdit, allowed: Set<string>): void => {
  const unknown = Object.keys(update).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw validationFailed(unknown.map((field) => ({
      field, code: 'object.unknown_keys', params: { keys: [field] },
    })));
  }
};

/** Whether the edit touches any fixed-term term. */
const anyTermKey = (update: TransactionEdit): boolean => (
  'rate' in update || 'dueDate' in update || 'interestPayment' in update || 'incentivised' in update
);

/** The fixed-term terms an edit changes — none when it touches no term. */
const termChangesOf = (update: TransactionEdit): HoldingTermChanges | undefined => {
  if (!anyTermKey(update)) return undefined;
  return {
    ...(update.rate !== undefined && { rate: holdingRateOf(update.rate!) }),
    ...(update.dueDate !== undefined && { dueDate: update.dueDate }),
    ...(update.interestPayment !== undefined && { interestPayment: update.interestPayment }),
    ...(update.incentivised !== undefined && { incentivised: update.incentivised }),
  };
};

/** The Category and Subcategory after an edit — a null Category clears its Subcategory. */
const categoriesOf = (transaction: AccountTransaction | CardTransaction, update: TransactionEdit): {
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
} => {
  const categoryId = update.categoryId !== undefined ? update.categoryId : transaction.categoryId;
  let subcategoryId = update.subcategoryId !== undefined
    ? update.subcategoryId
    : transaction.subcategoryId;
  if (categoryId === null) subcategoryId = null; // a Subcategory needs its Category
  return { categoryId, subcategoryId };
};

/** The base values an edit keeps — left-out fields keep theirs (OQ-201 D6). */
const keptBaseValues = (
  transaction: AccountTransaction | CardTransaction,
  update: TransactionEdit,
): {
  readonly date: string;
  readonly amount: number;
  readonly description: string | null;
} => ({
  date: update.date ?? transaction.date,
  amount: update.amount ?? transaction.amount,
  description: update.description !== undefined ? update.description : transaction.description,
});

/** The values a transaction holds after an edit — left-out fields keep theirs (OQ-201 D6). */
const mergedValuesOf = (
  row: EditableRow,
  kind: TransactionKind,
  update: TransactionEdit,
): MergedValues => {
  const { transaction } = row;
  const terms = kind.code === 'investment_buy' ? termChangesOf(update) : undefined;
  return {
    ...keptBaseValues(transaction, update),
    currency: transaction.currency,
    ...categoriesOf(transaction, update),
    ...(movesPosition(kind) && { quantity: update.quantity ?? row.storedQuantity }),
    ...(terms !== undefined && { terms }),
  };
};

/** Whether a base field changes — the five fields every kind shares. */
const baseFieldChanged = (
  transaction: AccountTransaction | CardTransaction,
  update: TransactionEdit,
): boolean => (
  BASE_FIELDS.some((field) => field in update && update[field] !== transaction[field])
);

/** Whether the edit changes anything — an empty edit re-reads without audit. */
const anythingChanged = (row: EditableRow, update: TransactionEdit): boolean => (
  baseFieldChanged(row.transaction, update) || 'quantity' in update
    || termChangesOf(update) !== undefined
);

/** A locked schedule takes only the fields that don't touch its terms (OQ-201 D8). */
const checkLockedTerms = (update: TransactionEdit, locked: boolean): void => {
  if (!locked) return;
  const allowed = new Set(['categoryId', 'subcategoryId', 'description']);
  const refused = Object.keys(update).filter((key) => !allowed.has(key));
  if (refused.length > 0) throw scheduleStarted();
};

/** The Category and Subcategory an edit names — history keeps an archived one. */
const checkEditCategory = async (
  deps: TransactionDeps,
  householdId: string,
  merged: MergedValues,
): Promise<void> => {
  if (!merged.categoryId) return;
  const category = await deps.categories.findById(householdId, merged.categoryId);
  if (!category) throw categoryNotFound();
  const subcategoryFits = merged.subcategoryId === null
    || category.subcategories.some((subcategory) => subcategory.id === merged.subcategoryId);
  if (!subcategoryFits) throw subcategoryMismatch();
};

/** The trade's new deltas from the position its reversal restored. */
const newTradeDeltasOf = (
  kind: TransactionKind,
  restored: RestoredPosition,
  merged: MergedValues,
): TradeDeltas => {
  if (kind.code === 'investment_buy') {
    return { quantityDelta: merged.quantity!, costBasisDelta: merged.amount };
  }
  const sold = merged.quantity!;
  // Average cost, not last-in price (OQ-171): the basis leaves pro rata.
  const basisOut = Math.round((restored.costBasis * sold) / restored.quantity);
  return { quantityDelta: -sold, costBasisDelta: -basisOut };
};

/** The Holding's terms as the Engine takes them after an edit (OQ-205). */
const editedTermsOf = (holding: InvestmentHolding, merged: MergedValues): ContractTerms => {
  const terms = merged.terms ?? {};
  const stored = terms.rate
    ? { type: terms.rate.rateType, value: terms.rate.rateValue, spread: terms.rate.rateSpread }
    : { type: holding.rateType!, value: holding.rateValue!, spread: holding.rateSpread };
  return {
    assetType: holding.assetType,
    incentivised: terms.incentivised !== undefined ? terms.incentivised : holding.incentivised,
    date: merged.date,
    amount: merged.amount,
    dueDate: terms.dueDate ?? holding.dueDate!,
    rate: engineRateOf(stored),
    interestPayment: terms.interestPayment ?? holding.interestPayment ?? 'at_maturity',
  };
};

/** The terms a fixed-term buy's edit writes — guarded like every other write (OQ-107). */
const expectedTermsOf = (holding: InvestmentHolding): ExpectedHoldingTerms => ({
  rateType: holding.rateType,
  rateValue: holding.rateValue,
  rateSpread: holding.rateSpread,
  dueDate: holding.dueDate,
  interestPayment: holding.interestPayment,
  incentivised: holding.incentivised,
});

/** Writes the new terms and recomputes the schedule (OQ-201 D8/OQ-205). */
const applyTermsEdit = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  householdId: string,
  holding: InvestmentHolding,
  merged: MergedValues,
): Promise<void> => {
  if (merged.terms !== undefined) {
    const updated = await stores.holdings.updateTerms(
      holding.id,
      expectedTermsOf(holding),
      merged.terms,
    );
    if (updated.status === 'stale') throw transactionChanged();
  }
  const scheduled = await deps.investmentProducts.schedule(
    householdId,
    editedTermsOf(holding, merged),
  );
  if (!scheduled.ok) throw indexRateMissing(scheduled.indexCode);
  const applied = await stores.holdings.applySchedule(holding.id, scheduled.entries);
  if (!applied.ok) {
    throw applied.reason === 'schedule_started' ? scheduleStarted() : transactionChanged();
  }
};

/** Whether the edit changes what a fixed-term buy's schedule is computed from —
 *  its terms, or the purchase's date and amount (OQ-205). */
const scheduleInputsChanged = (row: EditableRow, merged: MergedValues): boolean => {
  const transaction = row.transaction as AccountTransaction;
  return merged.terms !== undefined || merged.date !== transaction.date
    || merged.amount !== transaction.amount;
};

/**
 * A market-priced trade's automatic snapshot follows its edit: the Holding's
 * value before the trade (its own snapshot left out), moved by the new amount
 * (FR-5.2, PR #145).
 *
 * A fixed-term Holding has none (OQ-51).
 *
 * @param stores - The Accessors over one transaction.
 * @param row - The trade as stored.
 * @param kind - Its kind; the direction moves the value.
 * @param holding - The Holding, after the edit.
 * @param merged - Its values after the edit.
 * @param heldAfter - The units held once the edit is applied.
 */
const refreshSnapshot = async (
  stores: TransactionStores,
  row: EditableRow,
  kind: TransactionKind,
  holding: InvestmentHolding,
  merged: MergedValues,
  heldAfter: number,
): Promise<void> => {
  const transaction = row.transaction as AccountTransaction;
  if (isFixedTerm(holding.assetType)) return;
  const changed = merged.amount !== transaction.amount || merged.quantity !== row.storedQuantity
    || merged.date !== transaction.date;
  if (!changed) return;
  const before = await valueBefore(stores, holding.id, merged.date, transaction.id);
  await stores.valuations.updateAutomatic(transaction.id, {
    valuation: valueAfterTrade(before, kind.direction, merged.amount, heldAfter),
    asOfDate: merged.date,
  });
};

/** The checks a trade's edit passes before it writes — the fresh state decides. */
const checkTradeEdit = async (
  stores: TransactionStores,
  householdId: string,
  row: EditableRow,
  kind: TransactionKind,
  holdingId: string,
  merged: MergedValues,
  restored: RestoredPosition,
): Promise<InvestmentHolding> => {
  // The pre-read is for the checks; the write decides on the fresh state.
  const current = await stores.holdings.findById(householdId, holdingId);
  if (!current || current.accountId !== row.account.id) throw transactionChanged();
  if (current.archivedAt !== null && current.archivedBy === 'user') throw holdingArchived();
  if (kind.code === 'investment_redemption' && merged.quantity !== restored.quantity) {
    // A redemption is the whole position — still true after the reversal.
    throw validationFailed([{ field: 'quantity', code: 'field.invalid' }]);
  }
  return current;
};

/** What a trade's edit applies, gathered for one call. */
interface TradeEditArgs {
  readonly stores: TransactionStores;
  readonly deps: TransactionDeps;
  readonly householdId: string;
  readonly row: EditableRow;
  readonly kind: TransactionKind;
  readonly holding: InvestmentHolding;
  readonly merged: MergedValues;
  readonly restored: RestoredPosition;
}

/** The trade's edit: reapply its deltas on the position the reversal restored,
 *  plus its terms or snapshot. */
const applyTradeEdit = async ({
  stores, deps, householdId, row, kind, holding, merged, restored,
}: TradeEditArgs): Promise<TradeDeltas> => {
  const current = await checkTradeEdit(
    stores,
    householdId,
    row,
    kind,
    holding.id,
    merged,
    restored,
  );
  const trade = newTradeDeltasOf(kind, restored, merged);
  const applied = await stores.holdings.applyTrade(current.id, trade);
  if (!applied.ok) throw tradeRefusal(applied.reason);
  if (applied.quantity === 0) await stores.holdings.archive(current.id, 'system');
  if (kind.code === 'investment_buy' && isFixedTerm(current.assetType)) {
    // A started schedule refuses re-application — so it runs only when the
    // edit changes what it is computed from (OQ-201 D8).
    if (scheduleInputsChanged(row, merged)) {
      await applyTermsEdit(stores, deps, householdId, current, merged);
    }
  } else {
    await refreshSnapshot(stores, row, kind, current, merged, applied.quantity);
  }
  return trade;
};

/** The row's editable values as the accessor takes them. */
const changesOf = (merged: MergedValues) => ({
  date: merged.date,
  amount: merged.amount,
  categoryId: merged.categoryId,
  subcategoryId: merged.subcategoryId,
  description: merged.description,
});

/** The guarded write of the edited values — a concurrent edit is `stale` (OQ-203). */
const guardedUpdate = async (
  stores: TransactionStores,
  row: EditableRow,
  kind: TransactionKind,
  merged: MergedValues,
  trade?: TradeDeltas,
) => {
  if (row.ledger === 'card') {
    const transaction = row.transaction as CardTransaction;
    const expected: ExpectedCardTransaction = {
      date: transaction.date,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      subcategoryId: transaction.subcategoryId,
    };
    return stores.cardTransactions.update(transaction.id, expected, changesOf(merged));
  }
  const transaction = row.transaction as AccountTransaction;
  const expected: ExpectedTransaction = {
    date: transaction.date,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    subcategoryId: transaction.subcategoryId,
    trade: transaction.trade,
  };
  const changes = { ...changesOf(merged), ...(trade !== undefined && { trade }) };
  return stores.accountTransactions.update(transaction.id, expected, changes);
};

/** Reapplies a transaction's cash leg and accrual with its new values — the
 *  bill payment also raises its card's outstanding balance again. */
const reapplyEffects = async (
  stores: TransactionStores,
  row: EditableRow,
  kind: TransactionKind,
  merged: MergedValues,
): Promise<void> => {
  if (row.ledger === 'card') {
    const moved = await stores.creditCards.applyMovement(
      row.creditCardId!,
      cardMovementOf(kind, merged),
    );
    if (!moved.ok) throw transactionChanged();
  } else {
    const moved = await stores.accounts.applyMovement(
      row.account.id,
      accountMovementOf(kind, merged),
    );
    if (!moved.ok) throw transactionChanged();
    if (kind.code === 'credit_card_bill_payment' && row.creditCardId) {
      const paid = await stores.creditCards.applyMovement(row.creditCardId, {
        amount: -merged.amount, currency: merged.currency, date: merged.date,
      });
      if (!paid.ok) throw transactionChanged();
    }
  }
  const accrual = budgetAccrualOf(
    row.account,
    kind,
    merged,
    merged.categoryId,
    merged.subcategoryId,
  );
  await accrueBudget(stores, accrual);
};

/** Reverses, reapplies and writes — all in the one transaction (OQ-175). */
const applyEdit = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  householdId: string,
  row: EditableRow,
  kind: TransactionKind,
  holding: InvestmentHolding | undefined,
  merged: MergedValues,
): Promise<EditedTransaction> => {
  const restored = row.ledger === 'card'
    ? await reverseCardEffects(stores, row, kind)
    : await reverseAccountEffects(stores, row, kind);
  let trade: TradeDeltas | undefined;
  if (movesPosition(kind) && holding !== undefined && restored !== undefined) {
    trade = await applyTradeEdit({
      stores, deps, householdId, row, kind, holding, merged, restored,
    });
  }
  await reapplyEffects(stores, row, kind, merged);
  const updated = await guardedUpdate(stores, row, kind, merged, trade);
  if (updated.status !== 'updated') throw transactionChanged();
  return { ledger: row.ledger, transaction: updated.transaction };
};

/** The terms a fixed-term buy's edit would take — for the term checks. */
const termCheckValues = (holding: InvestmentHolding, merged: MergedValues): {
  readonly date?: string;
  readonly dueDate?: string | null;
  readonly rate?: RequestRate;
} => ({
  date: merged.date,
  dueDate: merged.terms?.dueDate ?? holding.dueDate,
  ...(merged.terms?.rate !== undefined && {
    rate: {
      type: merged.terms.rate.rateType,
      value: merged.terms.rate.rateValue,
      spread: merged.terms.rate.rateSpread,
    },
  }),
});

/** Builds the Edit Transaction use case. */
const createEdit = (deps: TransactionDeps) => ({
  /**
   * Edits a transaction's values, never its kind or target (CUC-2, OQ-201 D6/D8):
   * reverses the stored effects, reapplies them with the new values and
   * guarded-updates the row in one transaction. A concurrent write is a 409
   * `transaction.changed` (OQ-203); a fixed-term buy whose schedule has started
   * takes only category, subcategory and description.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param transactionId - The transaction on either ledger.
   * @param update - The new values; left-out fields keep theirs.
   * @returns The edited transaction, on its ledger.
   * @throws {DomainError} `transaction.not_found`; `auth.forbidden` /\\n
   *   `household.not_found`; `validation.failed`; `category.not_found` /\\n
   *   `transaction.subcategory_mismatch`; the trade's 409s; `index_rate.missing`.
   */
  editTransaction: async (
    context: SignedInContext,
    householdId: string,
    transactionId: string,
    update: TransactionEdit,
  ): Promise<EditedTransaction> => {
    const row = await loadEditable(deps, context, householdId, transactionId);
    const kind = findKind(row.transaction.kind);
    if (!kind) throw validationFailed([{ field: 'kind', code: 'field.invalid_option' }]);
    checkEditFields(update, editableFieldsOf(kind, assetTypeOf(row)));
    const merged = mergedValuesOf(row, kind, update);
    const holding = await tradeHoldingOf(deps, householdId, row, kind);
    if (kind.code === 'investment_buy' && holding !== undefined && isFixedTerm(holding.assetType)) {
      checkLockedTerms(update, await scheduleLocked(deps, holding.id));
      requireNoProblems(fixedTermProblems(termCheckValues(holding, merged)));
    }
    if (!anythingChanged(row, update)) return { ledger: row.ledger, transaction: row.transaction };
    await checkEditCategory(deps, householdId, merged);
    const edited = await deps.inTransaction<EditedTransaction>(
      (stores) => applyEdit(stores, deps, householdId, row, kind, holding, merged),
    );
    requestLogger(context).audit('EditTransaction', {
      entityType: row.ledger === 'card' ? 'CardTransaction' : 'AccountTransaction',
      entityId: transactionId,
      householdId,
    });
    return edited;
  },
});

export default createEdit;
