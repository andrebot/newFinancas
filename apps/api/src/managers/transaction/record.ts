import {
  findKind, isFixedTerm, isKindAllowed, type TransactionKind,
} from '@financas/reference';
import type {
  AccountTransaction, NewAccountTransaction, TradeDeltas, TransactionSource,
} from '../../accessors/accountTransactionAccessor';
import type { CardTransaction } from '../../accessors/cardTransactionAccessor';
import type { Account } from '../../accessors/accountAccessor';
import type { CreditCard } from '../../accessors/creditCardAccessor';
import type { AllocationShare, Goal, ReplaceAllocationsResult } from '../../accessors/goalAccessor';
import type { InvestmentHolding } from '../../accessors/investmentHoldingAccessor';
import type { InterestPayment, Role } from '../../db/schema/values';
import type { ContractTerms } from '../../engines/investmentProduct';
import { validationFailed, type DomainError } from '../../utilities/domainError';
import { distinctItems } from '../../utilities/validation';
import { accessToOwned, requireAccess } from '../access';
import { canSeeGoal, growsCompletedGoal, hiddenShares } from '../goalSplit';
import type { SignedInContext } from '../requestContext';
import { requireNoProblems } from '../validation';
import { reweightSplit } from './allocations';
import {
  accountMovementOf, accrueBudget, budgetAccrualOf, cardMovementOf, engineRateOf, holdingRateOf,
  valueAfterTrade, valueBefore,
} from './effects';
import {
  requestLogger, todayOf, type TransactionDeps, type TransactionStores,
} from './context';
import {
  accountArchived, accountNotFound, allocationExceeds100, categoryArchived, categoryNotFound,
  creditCardNotFound, currencyMismatch, goalCompleted, goalNotFound,
  holdingArchived, holdingNotFound, insufficientQuantity, indexRateMissing,
  investmentNotAllowedOnAccount, kindNotAllowedForTarget, subcategoryMismatch,
  transactionChanged, tradeRefusal,
} from './errors';
import { createProblems } from './kindRules';
import requirePaidCard from './paidCard';

// Record Transaction (CUC-1, FR-3): the household's cash-flow events — one of
// fifteen kinds (FR-3.1), each with its own side effects: a card balance or an
// Account movement, a Holding position and schedule for investment trades, an
// automatic snapshot for market-priced ones, a Goal split at record time
// (OQ-54/OQ-206) and the Budget accrual. The Manager decides which effect
// applies and what its parameters are; each Accessor executes one validated
// write, all in one transaction (OQ-175).

/** A recorded transaction, as the route validated it (the contract's create request). */
export interface TransactionCreate {
  readonly accountId?: string | undefined;
  readonly creditCardId?: string | undefined;
  readonly kind: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** Positive minor units. */
  readonly amount: number;
  readonly currency: string;
  readonly categoryId?: string | undefined;
  readonly subcategoryId?: string | undefined;
  readonly description?: string | undefined;
  readonly holdingId?: string | undefined;
  readonly assetType?: string | undefined;
  readonly ticker?: string | undefined;
  readonly quantity?: number | undefined;
  readonly rate?: {
    readonly type?: 'fixed' | 'cdi' | 'ipca' | 'igpm' | 'selic' | undefined;
    readonly value?: number | undefined;
    readonly spread?: number | null | undefined;
  } | null | undefined;
  readonly dueDate?: string | undefined;
  readonly interestPayment?: InterestPayment | undefined;
  readonly allocations?: readonly {
    readonly goalId: string;
    readonly percentage: number;
  }[] | undefined;
  readonly incentivised?: boolean | undefined;
  /** Internal only — a scheduled post's provenance (VBD §3.2a); the route never sets it. */
  readonly source?: TransactionSource | undefined;
}

/** A transaction recorded on either ledger. */
export type RecordedTransaction = AccountTransaction | CardTransaction;

/** The target a transaction is recorded against, and the caller's role. */
export interface LoadedTarget {
  readonly account: Account;
  /** For card kinds — the card itself. */
  readonly card?: CreditCard;
  readonly role: Role;
}

/**
 * Loads the card a charge or refund names, with its Account, deciding access on
 * the Account (a card has no owner of its own).
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param creditCardId - The card.
 * @returns The card, its Account and the caller's role.
 * @throws {DomainError} `household.not_found` / `credit_card.not_found`; `auth.forbidden`.
 */
const loadCardTarget = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  creditCardId: string,
): Promise<LoadedTarget> => {
  const card = await deps.creditCards.findById(householdId, creditCardId);
  const account = card && await deps.accounts.findById(householdId, card.accountId);
  const role = await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    accessToOwned(account, 'data.edit'),
    creditCardNotFound,
  );
  if (!card || !account) throw creditCardNotFound();
  return { account, card, role };
};

/**
 * The target gates a kind must pass (FR-3.1/OQ-76/OQ-201 D5, OQ-219): the kind
 * fits the target's type — a `credit_card_only` Account takes no Account
 * Transaction, investments named as such — the Account is open, and
 * the amount is in its currency (FR-2.2).
 *
 * @param kind - The kind.
 * @param target - The loaded target.
 * @param currency - The request's currency.
 * @throws {DomainError} `transaction.kind_not_allowed_for_target` /\
 *   `transaction.investment_not_allowed_on_account`; `account.archived`;
 *   `transaction.currency_mismatch`.
 */
const checkTarget = (kind: TransactionKind, target: LoadedTarget, currency: string): void => {
  const { account } = target;
  if (kind.target === 'account') {
    if (kind.group === 'investment' && account.type === 'credit_card_only') {
      throw investmentNotAllowedOnAccount();
    }
    if (!isKindAllowed(kind, { target: 'account', accountType: account.type })) {
      throw kindNotAllowedForTarget();
    }
  }
  if (account.archivedAt !== null) throw accountArchived();
  if (account.currency !== currency) throw currencyMismatch(account.currency);
};

/**
 * Loads the target a transaction is recorded against — its Account (and card),
 * deciding access on it. A bill payment's card may sit on any Account of the
 * household the caller may edit (OQ-219): the payer's gates are checked first,
 * then the card's own Account.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param request - The create request.
 * @param kind - Its kind, already looked up.
 * @returns The target and the caller's role.
 * @throws {DomainError} `household.not_found` / `account.not_found` /\
 *   `credit_card.not_found`; `auth.forbidden`; a bill payer's target gates;
 *   `credit_card.account_archived` / the paid card's `transaction.currency_mismatch`.
 */
const loadTarget = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  request: TransactionCreate,
  kind: TransactionKind,
): Promise<LoadedTarget> => {
  if (kind.target === 'card') {
    return loadCardTarget(deps, context, householdId, request.creditCardId!);
  }
  const account = await deps.accounts.findById(householdId, request.accountId!);
  const role = await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    accessToOwned(account, 'data.edit'),
    accountNotFound,
  );
  if (!account) throw accountNotFound();
  if (kind.code !== 'credit_card_bill_payment') return { account, role };
  checkTarget(kind, { account, role }, request.currency);
  const paid = await requirePaidCard(deps, context, householdId, request.creditCardId!);
  if (paid.account.currency !== request.currency) throw currencyMismatch(paid.account.currency);
  return { account, card: paid.card, role };
};

/**
 * Checks the Category and Subcategory a new transaction names (FR-3.4, OQ-201):
 * both must be this household's, the Subcategory under that Category — a
 * Subcategory without its Category is refused outright — and the Category open:
 * history keeps an archived one, new money doesn't go there.
 *
 * @param deps - The tier below.
 * @param householdId - The household.
 * @param request - The create request.
 * @throws {DomainError} `category.not_found`; `transaction.subcategory_mismatch`;
 *   `category.archived`.
 */
const checkCategory = async (
  deps: TransactionDeps,
  householdId: string,
  request: TransactionCreate,
): Promise<void> => {
  if (!request.categoryId) {
    // A Subcategory names its Category — without one it accrues to whatever
    // Budget claims the id.
    if (request.subcategoryId !== undefined) throw subcategoryMismatch();
    return;
  }
  const category = await deps.categories.findById(householdId, request.categoryId);
  if (!category) throw categoryNotFound();
  if (request.subcategoryId !== undefined
    && !category.subcategories.some((subcategory) => subcategory.id === request.subcategoryId)) {
    throw subcategoryMismatch();
  }
  if (category.archivedAt !== null) throw categoryArchived();
};

/** The row a card kind writes. */
const cardRowOf = (
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
  userId: string | null,
) => ({
  creditCardId: target.card!.id,
  kind: kind.code,
  date: request.date,
  amount: request.amount,
  currency: request.currency,
  ...(request.categoryId && { categoryId: request.categoryId }),
  ...(request.subcategoryId && { subcategoryId: request.subcategoryId }),
  ...(request.description !== undefined && { description: request.description }),
  createdByUserId: userId,
});

/** The Budget accrual of a recorded transaction (OQ-201 D4). */
const recordAccrualOf = (
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
) => (
  budgetAccrualOf(
    target.account,
    kind,
    request,
    request.categoryId ?? null,
    request.subcategoryId ?? null,
  )
);

/**
 * Records a charge or refund on the card ledger (FR-3.9): the row and the
 * outstanding balance move together, plus the Budget accrual.
 *
 * @param stores - The Accessors over one transaction.
 * @param target - The loaded card and its Account.
 * @param kind - The kind (charge or refund).
 * @param request - The create request.
 * @param userId - The recorder.
 * @returns The recorded Card Transaction.
 * @throws {DomainError} `transaction.changed` on a race (OQ-203).
 */
const writeCard = async (
  stores: TransactionStores,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
  userId: string | null,
): Promise<CardTransaction> => {
  const inserted = await stores.cardTransactions.insert(cardRowOf(target, kind, request, userId));
  if (!inserted.ok) throw transactionChanged();
  const moved = await stores.creditCards.applyMovement(
    target.card!.id,
    cardMovementOf(kind, request),
  );
  if (!moved.ok) throw transactionChanged();
  await accrueBudget(stores, recordAccrualOf(target, kind, request));
  return inserted.transaction;
};

/** The row an Account-ledger cash or transfer kind writes. */
const accountRowOf = (
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
  userId: string | null,
) => ({
  accountId: target.account.id,
  kind: kind.code,
  effect: kind.effect!,
  date: request.date,
  amount: request.amount,
  currency: request.currency,
  ...(request.categoryId && { categoryId: request.categoryId }),
  ...(request.subcategoryId && { subcategoryId: request.subcategoryId }),
  ...(request.description !== undefined && { description: request.description }),
  ...(kind.effect === 'bill_payment' && { creditCardId: target.card!.id }),
  ...(request.holdingId !== undefined && { holdingId: request.holdingId }),
  ...(request.source !== undefined && { source: request.source }),
  createdByUserId: userId,
});

/** The Holding a cash event names for traceability — user-archived ones are
 *  closed (FR-5.8/OQ-171). */
const checkNamedHolding = async (
  stores: TransactionStores,
  householdId: string,
  accountId: string,
  holdingId?: string,
): Promise<void> => {
  if (holdingId === undefined) return;
  const holding = await stores.holdings.findById(householdId, holdingId);
  if (!holding || holding.accountId !== accountId) throw holdingNotFound();
  if (holding.archivedAt !== null && holding.archivedBy === 'user') throw holdingArchived();
};

/**
 * Records a cash or transfer kind on the Account ledger (FR-3): the row and the
 * balance move together; a bill payment also lowers its card's outstanding
 * balance — the one bridge between the ledgers (FR-3.7).
 *
 * @param stores - The Accessors over one transaction.
 * @param target - The loaded Account.
 * @param kind - The kind (movement, transfer or bill_payment).
 * @param request - The create request.
 * @param userId - The recorder.
 * @returns The recorded Account Transaction.
 * @throws {DomainError} `transaction.changed` on a race (OQ-203); the named
 *   Holding's refusals.
 */
const writeAccountCash = async (
  stores: TransactionStores,
  householdId: string,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
  userId: string | null,
): Promise<AccountTransaction> => {
  await checkNamedHolding(stores, householdId, target.account.id, request.holdingId);
  const inserted = await stores.accountTransactions.insert(
    accountRowOf(target, kind, request, userId),
  );
  if (!inserted.ok) throw transactionChanged();
  const moved = await stores.accounts.applyMovement(
    target.account.id,
    accountMovementOf(kind, request),
  );
  if (!moved.ok) throw transactionChanged();
  if (kind.effect === 'bill_payment') {
    const paid = await stores.creditCards.applyMovement(target.card!.id, {
      amount: -request.amount, currency: request.currency, date: request.date,
    });
    if (!paid.ok) throw transactionChanged();
  }
  await accrueBudget(stores, recordAccrualOf(target, kind, request));
  return inserted.transaction;
};

/** The Goals of a split the caller can see, by id. */
const visibleGoals = async (
  deps: TransactionDeps,
  householdId: string,
  role: Role,
  userId: string,
  goalIds: readonly string[],
): Promise<Map<string, Goal>> => {
  const goals = await deps.goals.findByIds(householdId, [...new Set(goalIds)]);
  const visible = goals.filter((goal) => canSeeGoal(role, userId, goal));
  return new Map(visible.map((goal) => [goal.id, goal]));
};

/** Turns GoalAccessor's refusal of a split into the API's answer. */
const splitRefusal = (result: Exclude<ReplaceAllocationsResult, { ok: true }>): DomainError => {
  if (result.reason === 'holding_not_found') return holdingNotFound();
  if (result.reason === 'goal_not_found') return goalNotFound();
  return allocationExceeds100(result.current, result.requested);
};

/** The request's allocations as plain shares. */
const sharesOf = (request: TransactionCreate): AllocationShare[] => (
  (request.allocations ?? []).map(({ goalId, percentage }) => ({ goalId, percentage }))
);

/**
 * Checks a buy's allocation of the purchase (OQ-168/OQ-206): each Goal named
 * once and visible; a completed Goal takes no new money — re-weighting its
 * existing pair is exempt.
 *
 * @param deps - The tier below.
 * @param householdId - The household.
 * @param role - The caller's role.
 * @param userId - The caller.
 * @param purchase - How the purchase is allocated.
 * @throws {DomainError} `validation.failed`; `goal.not_found`; `goal.completed`.
 */
const checkBuySplit = async (
  deps: TransactionDeps,
  householdId: string,
  role: Role,
  userId: string,
  purchase: readonly AllocationShare[],
): Promise<void> => {
  requireNoProblems(distinctItems('allocations', purchase, 'goalId'));
  const goalIds = purchase.map((share) => share.goalId);
  const visible = await visibleGoals(deps, householdId, role, userId, goalIds);
  if (purchase.some((share) => !visible.has(share.goalId))) throw goalNotFound();
  const completed = new Set([...visible.values()]
    .filter((goal) => goal.completedAt !== null).map((goal) => goal.id));
  if (purchase.some((share) => completed.has(share.goalId))) throw goalCompleted();
};

/** Writes a split over the Holding, mapping the Accessor's refusals. */
const replaceSplit = async (
  stores: TransactionStores,
  householdId: string,
  holdingId: string,
  split: AllocationShare[],
  validFrom: string,
): Promise<void> => {
  const result = await stores.goals.replaceAllocations(householdId, holdingId, split, validFrom);
  if (!result.ok) throw splitRefusal(result);
};

/**
 * Writes a buy's Goal split (OQ-168/OQ-207): on a fresh Holding the purchase's
 * own shares from its date; buying into an existing one re-weights the whole
 * split by value — the Holding's value before the buy (its latest snapshot by
 * then, PR #145) — so every Goal keeps exactly its money. A buy that allocates
 * nothing dilutes: the existing shares shrink to their old value over the new
 * total and the new money shows as unassigned — a Goal never grows without a
 * decision (FR-8.9).
 *
 * @param stores - The Accessors over one transaction.
 * @param deps - The tier below.
 * @param householdId - The household.
 * @param role - The caller's role.
 * @param userId - The caller.
 * @param holding - The Holding the buy lands in, with its position before.
 * @param request - The create request.
 */
const writeBuyAllocations = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  householdId: string,
  role: Role,
  userId: string,
  holding: InvestmentHolding,
  request: TransactionCreate,
): Promise<void> => {
  const purchase = sharesOf(request);
  const current = await stores.goals.listAllocations({ holdingId: holding.id });
  if (purchase.length === 0) {
    // No allocation on the buy — nothing to check; an existing split dilutes.
    if (current.length === 0) return;
    const existing = await valueBefore(stores, holding.id, request.date);
    await replaceSplit(
      stores,
      householdId,
      holding.id,
      reweightSplit(current, existing, [], request.amount),
      request.date,
    );
    return;
  }
  await checkBuySplit(deps, householdId, role, userId, purchase);
  let split: AllocationShare[];
  if (current.length === 0) {
    split = purchase;
  } else {
    const total = current.reduce((sum, share) => sum + share.percentage, 0);
    const requested = purchase.reduce((sum, share) => sum + share.percentage, 0);
    if (requested > 100) throw allocationExceeds100(total, requested);
    const existing = await valueBefore(stores, holding.id, request.date);
    split = reweightSplit(current, existing, purchase, request.amount);
  }
  await replaceSplit(stores, householdId, holding.id, split, request.date);
};

/**
 * Writes a sell or redemption's Goal split (OQ-206): the Holding's split,
 * pre-filled and editable, saved with the trade from today — over the Goals the
 * caller can see, hidden shares carried over (OQ-178).
 *
 * @param stores - The Accessors over one transaction.
 * @param deps - The tier below.
 * @param householdId - The household.
 * @param role - The caller's role.
 * @param userId - The caller.
 * @param holding - The Holding the trade leaves.
 * @param request - The create request; no allocations means the split is kept.
 */
const writeTradeSplit = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  householdId: string,
  role: Role,
  userId: string,
  holding: InvestmentHolding,
  request: TransactionCreate,
): Promise<void> => {
  if (request.allocations === undefined) return;
  const requested = sharesOf(request);
  const current = await stores.goals.listAllocations({ holdingId: holding.id });
  requireNoProblems(distinctItems('allocations', requested, 'goalId'));
  const visible = await visibleGoals(deps, householdId, role, userId, [
    ...current.map((share) => share.goalId), ...requested.map((share) => share.goalId),
  ]);
  if (requested.some((share) => !visible.has(share.goalId))) throw goalNotFound();
  const completed = new Set([...visible.values()]
    .filter((goal) => goal.completedAt !== null).map((goal) => goal.id));
  if (growsCompletedGoal(requested, current, completed)) throw goalCompleted();
  const split = [...hiddenShares(current, new Set(visible.keys())), ...requested];
  const result = await stores.goals.replaceAllocations(
    householdId,
    holding.id,
    split,
    todayOf(deps),
  );
  if (!result.ok) throw splitRefusal(result);
};

/** The Holding's terms as the Engine takes them (OQ-205). */
const contractTermsOf = (request: TransactionCreate): ContractTerms => ({
  assetType: request.assetType!,
  incentivised: request.incentivised ?? null,
  date: request.date,
  amount: request.amount,
  dueDate: request.dueDate!,
  rate: engineRateOf(request.rate!),
  interestPayment: request.interestPayment ?? 'at_maturity',
});

/**
 * Opens (or reopens) the market-priced Holding a buy accumulates into.
 *
 * @param stores - The Accessors over one transaction.
 * @param base - Its Account, asset type and ticker.
 * @returns The open Holding.
 * @throws {DomainError} `holding.archived`; `transaction.changed` on a race (OQ-203).
 */
const openMarketHolding = async (
  stores: TransactionStores,
  base: { readonly accountId: string; readonly assetType: string; readonly ticker: string },
): Promise<InvestmentHolding> => {
  const existing = await stores.holdings.findByTicker(base.accountId, base.assetType, base.ticker);
  if (!existing) {
    const created = await stores.holdings.insert(base);
    if (!created.ok) throw transactionChanged();
    return created.holding;
  }
  if (existing.archivedAt !== null && existing.archivedBy === 'user') throw holdingArchived();
  // A system archive is undone by the trade itself (OQ-171).
  await stores.holdings.unarchiveIfSystemArchived(existing.id);
  return existing;
};

/**
 * Resolves the Holding a buy lands in (OQ-50/OQ-171): a fixed-term buy always
 * opens a new one with its terms and schedule; a market-priced buy accumulates
 * into this Account's Holding of the same asset type and ticker — a zeroed,
 * system-archived one reopens, a user-archived one refuses.
 *
 * @param stores - The Accessors over one transaction.
 * @param deps - The tier below (the Engine reads its index itself).
 * @param householdId - The household.
 * @param target - The loaded Account.
 * @param request - The create request, an investment_buy.
 * @returns The Holding the buy lands in.
 * @throws {DomainError} `holding.archived`; `index_rate.missing`;
 *   `transaction.changed` on a race (OQ-203).
 */
const resolveBuyHolding = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  householdId: string,
  target: LoadedTarget,
  request: TransactionCreate,
): Promise<InvestmentHolding> => {
  const base = {
    accountId: target.account.id, assetType: request.assetType!, ticker: request.ticker!,
  };
  if (!isFixedTerm(request.assetType!)) return openMarketHolding(stores, base);
  const created = await stores.holdings.insert({
    ...base,
    rate: holdingRateOf(request.rate!),
    ...(request.incentivised !== undefined && { incentivised: request.incentivised }),
    interestPayment: request.interestPayment ?? 'at_maturity',
    dueDate: request.dueDate!,
  });
  if (!created.ok) throw transactionChanged();
  const scheduled = await deps.investmentProducts.schedule(householdId, contractTermsOf(request));
  if (!scheduled.ok) throw indexRateMissing(scheduled.indexCode);
  const applied = await stores.holdings.applySchedule(created.holding.id, scheduled.entries);
  if (!applied.ok) throw transactionChanged();
  return created.holding;
};

/** The row an investment trade writes (buy, sell or redemption). */
const tradeRowOf = (
  target: LoadedTarget,
  kindCode: string,
  request: TransactionCreate,
  holdingId: string,
  trade: TradeDeltas,
  userId: string | null,
): NewAccountTransaction => ({
  accountId: target.account.id,
  kind: kindCode,
  effect: 'investment_trade',
  date: request.date,
  amount: request.amount,
  currency: request.currency,
  ...(request.categoryId && { categoryId: request.categoryId }),
  ...(request.subcategoryId && { subcategoryId: request.subcategoryId }),
  ...(request.description !== undefined && { description: request.description }),
  ...(request.source !== undefined && { source: request.source }),
  holdingId,
  trade,
  createdByUserId: userId,
});

/**
 * A market-priced trade's automatic snapshot: the Holding's value before it,
 * moved by the trade's amount (FR-5.2, PR #145). Written after the split,
 * which reads the value before the trade.
 *
 * @param stores - The Accessors over one transaction.
 * @param holdingId - The Holding.
 * @param transactionId - The trade.
 * @param kind - The trade's kind; its direction moves the value.
 * @param request - The trade's amount and date.
 * @param heldAfter - The units held after the trade.
 */
const insertTradeSnapshot = async (
  stores: TransactionStores,
  holdingId: string,
  transactionId: string,
  kind: TransactionKind,
  request: Pick<TransactionCreate, 'amount' | 'date'>,
  heldAfter: number,
): Promise<void> => {
  const before = await valueBefore(stores, holdingId, request.date);
  await stores.valuations.insertAutomatic({
    holdingId,
    accountTransactionId: transactionId,
    valuation: valueAfterTrade(before, kind.direction, request.amount, heldAfter),
    asOfDate: request.date,
  });
};

/**
 * Records an investment buy (FR-3.8, OQ-201 D1): the cash leg debits the
 * Account, the Holding takes its position — a fixed-term one with its schedule
 * first — the Goal split is written in the same call (OQ-54), and a
 * market-priced buy then leaves its automatic snapshot: the value before plus
 * what was paid (PR #145).
 *
 * @param stores - The Accessors over one transaction.
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param target - The loaded Account.
 * @param kind - investment_buy.
 * @param request - The create request, an investment_buy.
 * @returns The recorded Account Transaction.
 * @throws {DomainError} `holding.archived`; `index_rate.missing`;
 *   `transaction.changed` on a race (OQ-203); the split's refusals.
 */
const writeBuy = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  userId: string | null,
  householdId: string,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
): Promise<AccountTransaction> => {
  const holding = await resolveBuyHolding(stores, deps, householdId, target, request);
  const quantity = request.quantity ?? 1;
  const trade: TradeDeltas = { quantityDelta: quantity, costBasisDelta: request.amount };
  const inserted = await stores.accountTransactions.insert(
    tradeRowOf(target, 'investment_buy', request, holding.id, trade, userId),
  );
  if (!inserted.ok) throw transactionChanged();
  const moved = await stores.accounts.applyMovement(
    target.account.id,
    accountMovementOf(kind, request),
  );
  if (!moved.ok) throw transactionChanged();
  const traded = await stores.holdings.applyTrade(holding.id, trade);
  // A buy only adds position and basis — the row vanishing is its one refusal.
  if (!traded.ok) throw holdingNotFound();
  // A scheduled post never records a buy, so this branch's userId is never null.
  await writeBuyAllocations(stores, deps, householdId, target.role, userId!, holding, request);
  if (!isFixedTerm(request.assetType!)) {
    await insertTradeSnapshot(
      stores,
      holding.id,
      inserted.transaction.id,
      kind,
      request,
      traded.quantity,
    );
  }
  await accrueBudget(stores, recordAccrualOf(target, kind, request));
  return inserted.transaction;
};

/** The Holding a trade names: this household's, in the named Account — anything else is its own
 * not-found. */
const loadTradeHolding = async (
  stores: TransactionStores,
  householdId: string,
  accountId: string,
  holdingId: string,
): Promise<InvestmentHolding> => {
  const holding = await stores.holdings.findById(householdId, holdingId);
  if (!holding || holding.accountId !== accountId) throw holdingNotFound();
  if (holding.archivedAt !== null && holding.archivedBy === 'user') throw holdingArchived();
  return holding;
};

/** A sell's Holding must hold position; a redemption closes it whole (OQ-171). */
const checkTradeQuantity = (
  kind: TransactionKind,
  holding: InvestmentHolding,
  quantity: number,
): void => {
  if (holding.quantity === 0) throw insufficientQuantity();
  if (kind.code === 'investment_redemption' && quantity !== holding.quantity) {
    throw validationFailed([{ field: 'quantity', code: 'field.invalid' }]);
  }
};

/**
 * Records a sell or redemption (FR-3.8, OQ-171): the proceeds credit the
 * Account, the position falls at its average cost — a redemption closes it, so
 * its quantity must be the whole one — and zeroing auto-archives the Holding;
 * market-priced trades leave their snapshot, and the split is saved with the
 * trade (OQ-206).
 *
 * @param stores - The Accessors over one transaction.
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param target - The loaded Account.
 * @param kind - investment_sell or investment_redemption.
 * @param request - The create request.
 * @returns The recorded Account Transaction.
 * @throws {DomainError} `holding.not_found` / `holding.archived`;
 *   `validation.failed` (a redemption of less than the whole position);
 *   `holding.insufficient_quantity` / `holding.cost_basis_below_zero`;
 *   `transaction.changed` on a race (OQ-203); the split's refusals.
 */
const writeSellOrRedemption = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  userId: string | null,
  householdId: string,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
): Promise<AccountTransaction> => {
  const holding = await loadTradeHolding(
    stores,
    householdId,
    target.account.id,
    request.holdingId!,
  );
  checkTradeQuantity(kind, holding, request.quantity!);
  const sold = request.quantity!;
  // Average cost: the share of the basis the sold quantity represents (OQ-171).
  const costBasisDelta = -Math.round((holding.costBasis * sold) / holding.quantity);
  const trade: TradeDeltas = { quantityDelta: -sold, costBasisDelta };
  const inserted = await stores.accountTransactions.insert(
    tradeRowOf(target, kind.code, request, holding.id, trade, userId),
  );
  if (!inserted.ok) throw transactionChanged();
  const moved = await stores.accounts.applyMovement(
    target.account.id,
    accountMovementOf(kind, request),
  );
  if (!moved.ok) throw transactionChanged();
  const traded = await stores.holdings.applyTrade(holding.id, trade);
  if (!traded.ok) throw tradeRefusal(traded.reason);
  if (traded.quantity === 0) await stores.holdings.archive(holding.id, 'system');
  if (!isFixedTerm(holding.assetType)) {
    await insertTradeSnapshot(
      stores,
      holding.id,
      inserted.transaction.id,
      kind,
      request,
      traded.quantity,
    );
  }
  // A scheduled post carries no split — the Holding's current one stands (OQ-206).
  await writeTradeSplit(stores, deps, householdId, target.role, userId!, holding, request);
  await accrueBudget(stores, recordAccrualOf(target, kind, request));
  return inserted.transaction;
};

/**
 * Records an investment trade: the cash leg and the Holding's position move
 * together, with its snapshot, schedule and Goal split.
 *
 * @param stores - The Accessors over one transaction.
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param target - The loaded Account.
 * @param kind - The kind (an investment_trade).
 * @param request - The create request.
 * @returns The recorded Account Transaction.
 */
const writeInvestmentTrade = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  userId: string | null,
  householdId: string,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
): Promise<AccountTransaction> => (
  kind.code === 'investment_buy'
    ? writeBuy(stores, deps, userId, householdId, target, kind, request)
    : writeSellOrRedemption(stores, deps, userId, householdId, target, kind, request)
);

/** Every side effect of a Record, on the Accessors over one transaction. */
const writeDispatch = async (
  stores: TransactionStores,
  deps: TransactionDeps,
  householdId: string,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
  userId: string | null,
): Promise<RecordedTransaction> => {
  if (kind.target === 'card') return writeCard(stores, target, kind, request, userId);
  if (kind.effect === 'investment_trade') {
    return writeInvestmentTrade(stores, deps, userId, householdId, target, kind, request);
  }
  return writeAccountCash(stores, householdId, target, kind, request, userId);
};

/** The Account a scheduled post names — no caller to authorise (VBD §3.2a). */
export const loadScheduledTarget = async (
  deps: TransactionDeps,
  householdId: string,
  accountId: string,
): Promise<LoadedTarget> => {
  const account = await deps.accounts.findById(householdId, accountId);
  if (!account) throw accountNotFound();
  return { account, role: 'Owner' };
};

/**
 * The Record pipeline's writes, shared by user entry and scheduled posts
 * (VBD §3.1/§3.2a): the target checks, then every side effect in one
 * transaction — all or nothing (OQ-175).
 */
export const recordCore = async (
  deps: TransactionDeps,
  householdId: string,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
  userId: string | null,
): Promise<RecordedTransaction> => {
  checkTarget(kind, target, request.currency);
  await checkCategory(deps, householdId, request);
  return deps.inTransaction<RecordedTransaction>(
    (stores) => writeDispatch(stores, deps, householdId, target, kind, request, userId),
  );
};

/**
 * A due schedule entry posts through the exact same pipeline (VBD §3.2a), with
 * `markEntryPosted` first in the same transaction: a second delivery of the
 * event finds it posted and does nothing more (OQ-171). Runs as the system —
 * no user behind it, so its row carries none.
 */
export const recordScheduled = async (
  deps: TransactionDeps,
  householdId: string,
  target: LoadedTarget,
  kind: TransactionKind,
  request: TransactionCreate,
  scheduleEntryId: string,
): Promise<RecordedTransaction | undefined> => {
  checkTarget(kind, target, request.currency);
  await checkCategory(deps, householdId, request);
  return deps.inTransaction<RecordedTransaction | undefined>(async (stores) => {
    if (!(await stores.holdings.markEntryPosted(scheduleEntryId))) return undefined;
    return writeDispatch(stores, deps, householdId, target, kind, request, null);
  });
};

/** Builds the Record Transaction use case. */
const createRecord = (deps: TransactionDeps) => ({
  /**
   * Records a transaction on either ledger (CUC-1, FR-3): validates the kind's
   * fields and terms, loads and checks its target, then applies every side
   * effect in one transaction — all or nothing (OQ-175).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param request - What to record, as the route validated it.
   * @returns The recorded transaction, on its ledger.
   * @throws {DomainError} `validation.failed`; `auth.forbidden` /\
   *   `household.not_found` / `account.not_found` / `credit_card.not_found` /\
   *   `category.not_found` / `goal.not_found`; the target and split's 409s;
   *   `index_rate.missing`.
   */
  recordTransaction: async (
    context: SignedInContext,
    householdId: string,
    request: TransactionCreate,
  ): Promise<RecordedTransaction> => {
    const kind = findKind(request.kind);
    if (!kind) throw validationFailed([{ field: 'kind', code: 'field.invalid_option' }]);
    requireNoProblems(createProblems(request, kind));
    const target = await loadTarget(deps, context, householdId, request, kind);
    const transaction = await recordCore(
      deps,
      householdId,
      target,
      kind,
      request,
      context.actor.userId,
    );
    requestLogger(context).audit('RecordTransaction', {
      entityType: kind.target === 'card' ? 'CardTransaction' : 'AccountTransaction',
      entityId: transaction.id,
      householdId,
    });
    return transaction;
  },
});

export default createRecord;
