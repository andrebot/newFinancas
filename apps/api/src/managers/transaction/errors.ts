import { createDomainError, type DomainError } from '../../utilities/domainError';

// TransactionManager's rejections, in the contract's codes (OQ-114): the Manager
// turns an Accessor's refusal or a rule it owns into the API's answer.

/**
 * An Account that isn't this household's, doesn't exist, or is someone else's
 * personal one — the same answer, so it never confirms one exists.
 *
 * @returns `account.not_found`.
 */
export const accountNotFound = (): DomainError => createDomainError({
  code: 'account.not_found', message: 'Account not found',
});

/**
 * A Credit Card that isn't this household's, doesn't exist, or sits on someone
 * else's personal Account — the same answer for all three.
 *
 * @returns `credit_card.not_found`.
 */
export const creditCardNotFound = (): DomainError => createDomainError({
  code: 'credit_card.not_found', message: 'Credit card not found',
});

/**
 * A Holding that isn't this household's, doesn't exist, or sits in someone
 * else's personal Account.
 *
 * @returns `holding.not_found`.
 */
export const holdingNotFound = (): DomainError => createDomainError({
  code: 'holding.not_found', message: 'Holding not found',
});

/**
 * A Category that isn't this household's, or doesn't exist.
 *
 * @returns `category.not_found`.
 */
export const categoryNotFound = (): DomainError => createDomainError({
  code: 'category.not_found', message: 'Category not found',
});

/**
 * A Goal that isn't this household's, doesn't exist, or is someone else's
 * personal one.
 *
 * @returns `goal.not_found`.
 */
export const goalNotFound = (): DomainError => createDomainError({
  code: 'goal.not_found', message: 'Goal not found',
});

/**
 * A transaction that isn't this household's, on either ledger — the id says
 * which by its row (OQ-201).
 *
 * @returns `transaction.not_found`.
 */
export const transactionNotFound = (): DomainError => createDomainError({
  code: 'transaction.not_found', message: 'Transaction not found',
});

/**
 * Recording or editing against an archived Account: archiving is one-way
 * (FR-2.4, OQ-169).
 *
 * @returns `account.archived`.
 */
export const accountArchived = (): DomainError => createDomainError({
  code: 'account.archived', message: 'Account is archived',
});

/**
 * A bill payment — recorded, edited or deleted — on a card whose Account is
 * archived (OQ-219): the payer may be open, but the card's balance can't move.
 *
 * @returns `credit_card.account_archived`.
 */
export const cardAccountArchived = (): DomainError => createDomainError({
  code: 'credit_card.account_archived', message: "Credit card's account is archived",
});

/**
 * A sell or cash event on a user-archived Holding (FR-5.8, OQ-80): a system
 * archive is undone by the trade itself, a user's stays.
 *
 * @returns `holding.archived`.
 */
export const holdingArchived = (): DomainError => createDomainError({
  code: 'holding.archived', message: 'Holding is archived',
});

/**
 * A kind recorded against a target that takes no such kind (FR-3.1, OQ-201):
 * a card target with an account kind, or a cash/transfer kind on a
 * credit-card-only Account.
 *
 * @returns `transaction.kind_not_allowed_for_target`.
 */
export const kindNotAllowedForTarget = (): DomainError => createDomainError({
  code: 'transaction.kind_not_allowed_for_target',
  message: 'This target takes no such transaction kind',
});

/**
 * An investment kind on a credit-card-only Account (OQ-76).
 *
 * @returns `transaction.investment_not_allowed_on_account`.
 */
export const investmentNotAllowedOnAccount = (): DomainError => createDomainError({
  code: 'transaction.investment_not_allowed_on_account',
  message: 'Investments live in checking, savings or investment accounts',
});

/**
 * The amount's currency isn't the target Account's (FR-2.2): no conversion
 * anywhere.
 *
 * @param accountCurrency - The Account's currency.
 * @returns `transaction.currency_mismatch`, naming it.
 */
export const currencyMismatch = (accountCurrency: string): DomainError => createDomainError({
  code: 'transaction.currency_mismatch',
  message: 'The amount is not in the account currency',
  params: { accountCurrency },
});

/**
 * A Subcategory that isn't under the chosen Category, or one without a
 * Category (FR-3.4).
 *
 * @returns `transaction.subcategory_mismatch`.
 */
export const subcategoryMismatch = (): DomainError => createDomainError({
  code: 'transaction.subcategory_mismatch',
  message: 'The subcategory does not belong to the category',
});

/**
 * A new transaction on an archived Category (OQ-201): history keeps it, new
 * money doesn't go there. An edit may keep the one it already has.
 *
 * @returns `category.archived`.
 */
export const categoryArchived = (): DomainError => createDomainError({
  code: 'category.archived', message: 'Category is archived',
});

/**
 * A fixed-term buy whose index-linked rate has no value recorded yet (OQ-205):
 * nothing is projected from a made-up rate — record the value first.
 *
 * @param indexCode - The index with no value.
 * @returns `index_rate.missing`, naming it.
 */
export const indexRateMissing = (indexCode: string): DomainError => createDomainError({
  code: 'index_rate.missing',
  message: 'No value recorded for this index yet',
  params: { indexCode },
});

/**
 * A completed Goal given a bigger share, or a new one (FR-8.9, OQ-168).
 *
 * @returns `goal.completed`.
 */
export const goalCompleted = (): DomainError => createDomainError({
  code: 'goal.completed', message: 'A completed goal takes no new funding',
});

/**
 * A Holding split past 100% (FR-8.3).
 *
 * @param current - The Holding's total before.
 * @param requested - The refused total, hidden shares included (OQ-178).
 * @returns `goal.allocation_exceeds_100` with both totals.
 */
export const allocationExceeds100 = (current: number, requested: number): DomainError => (
  createDomainError({
    code: 'goal.allocation_exceeds_100',
    message: 'Allocations would exceed 100%',
    params: { current, requested },
  })
);

/**
 * A trade that would take a Holding's position below zero (OQ-171).
 *
 * @returns `holding.insufficient_quantity`.
 */
export const insufficientQuantity = (): DomainError => createDomainError({
  code: 'holding.insufficient_quantity', message: 'The holding has no such quantity',
});

/**
 * A trade that would take a Holding's cost basis below zero (OQ-171).
 *
 * @returns `holding.cost_basis_below_zero`.
 */
export const costBasisBelowZero = (): DomainError => createDomainError({
  code: 'holding.cost_basis_below_zero', message: 'The trade would take the cost basis below zero',
});

/**
 * A ledger write that lost a race (OQ-203): an Edit or Delete whose guarded
 * write came back stale, or a Record whose Account, Holding, card or recorder
 * vanished between the checks and the insert. The unit of work rolled the
 * pipeline's other writes back; reload and retry gets the precise answer.
 *
 * @returns `transaction.changed`.
 */
export const transactionChanged = (): DomainError => createDomainError({
  code: 'transaction.changed',
  message: 'This transaction changed meanwhile — reload it and try again',
});

/**
 * A fixed-term buy whose schedule has posted keeps its amount, date and terms
 * (OQ-201, D8) — description and category still edit.
 *
 * @returns `transaction.schedule_started`.
 */
export const scheduleStarted = (): DomainError => createDomainError({
  code: 'transaction.schedule_started', message: 'This buy has already started paying out',
});

/**
 * Deleting the buy that created a Holding while other transactions still
 * reference it (OQ-201, D7).
 *
 * @param count - How many others do.
 * @returns `transaction.holding_in_use`, naming the count.
 */
export const holdingInUse = (count: number): DomainError => createDomainError({
  code: 'transaction.holding_in_use',
  message: 'Other transactions still reference this holding',
  params: { count },
});

/** Maps a refused trade to its error (OQ-203). */
export const tradeRefusal = (reason: string): DomainError => {
  if (reason === 'holding_not_found') return holdingNotFound();
  if (reason === 'cost_basis_below_zero') return costBasisBelowZero();
  return insufficientQuantity();
};
