import type { BudgetTarget } from '../../accessors/budgetAccessor';
import type { ManualRefusal } from '../../accessors/valuationSnapshotAccessor';
import type { StyleRefusal } from '../../accessors/categoryAccessor';
import { createDomainError, validationFailed, type DomainError } from '../../utilities/domainError';

// AccountManager's rejections, in the contract's codes (OQ-114): the Manager
// turns an Accessor's refusal into the API's answer.

/**
 * A Category that isn't this household's, or doesn't exist.
 *
 * @returns `category.not_found`.
 */
export const categoryNotFound = (): DomainError => createDomainError({
  code: 'category.not_found', message: 'Category not found',
});

/**
 * A Subcategory that isn't under this Category (OQ-173).
 *
 * @returns `subcategory.not_found`.
 */
export const subcategoryNotFound = (): DomainError => createDomainError({
  code: 'subcategory.not_found', message: 'Subcategory not found',
});

/**
 * An icon or colour outside the in-code sets, refused by CategoryAccessor as a
 * second line behind the contract's enums (OQ-173) — answered like the route's
 * own enum check, on the field.
 *
 * @param refusal - `invalid_icon` or `invalid_color`.
 * @returns `validation.failed` on `icon` or `color`.
 */
export const invalidCategoryStyle = (refusal: StyleRefusal): DomainError => validationFailed([{
  field: refusal === 'invalid_icon' ? 'icon' : 'color', code: 'field.invalid_option',
}]);

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
 * A Credit Card not on this Account, or on an Account the caller can't see.
 *
 * @returns `credit_card.not_found`.
 */
export const creditCardNotFound = (): DomainError => createDomainError({
  code: 'credit_card.not_found', message: 'Credit card not found',
});

/**
 * An edit of an archived Account: archiving is one-way (FR-2.4, OQ-175).
 *
 * @returns `account.archived`.
 */
export const accountArchived = (): DomainError => createDomainError({
  code: 'account.archived', message: 'Account is archived',
});

/**
 * A card attached to an Account type that takes none (FR-2.7).
 *
 * @returns `account.cards_not_allowed`.
 */
export const cardsNotAllowed = (): DomainError => createDomainError({
  code: 'account.cards_not_allowed', message: 'This account type takes no cards',
});

/**
 * A Budget that isn't this household's, doesn't exist (a hard delete leaves
 * nothing), or is someone else's personal one (OQ-176).
 *
 * @returns `budget.not_found`.
 */
export const budgetNotFound = (): DomainError => createDomainError({
  code: 'budget.not_found', message: 'Budget not found',
});

/**
 * A target another Budget in the scope already claims (FR-4.7). The claimant is
 * always one the caller can see: it sits in the same scope (OQ-176).
 *
 * @param target - The refused claim.
 * @param budgetId - The Budget claiming it.
 * @returns `budget.target_already_claimed`, naming the target and the Budget.
 */
export const targetAlreadyClaimed = (target: BudgetTarget, budgetId: string): DomainError => (
  createDomainError({
    code: 'budget.target_already_claimed',
    message: 'Target already claimed by another budget',
    params: { ...target, budgetId },
  })
);

/**
 * A Goal that isn't this household's, doesn't exist (a hard delete leaves
 * nothing), or is someone else's personal one (OQ-177).
 *
 * @returns `goal.not_found`.
 */
export const goalNotFound = (): DomainError => createDomainError({
  code: 'goal.not_found', message: 'Goal not found',
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
 * A Holding that isn't this household's, doesn't exist, or sits in someone
 * else's personal Account (OQ-178).
 *
 * @returns `holding.not_found`.
 */
export const holdingNotFound = (): DomainError => createDomainError({
  code: 'holding.not_found', message: 'Holding not found',
});

/**
 * A change to an archived Holding: archiving is one-way (FR-5.8, OQ-178).
 *
 * @returns `holding.archived`.
 */
export const holdingArchived = (): DomainError => createDomainError({
  code: 'holding.archived', message: 'Holding is archived',
});

/**
 * A manual archive of a Holding that isn't fixed-term, past due and still
 * holding a position (FR-5.8, OQ-178).
 *
 * @returns `holding.not_matured`.
 */
export const holdingNotMatured = (): DomainError => createDomainError({
  code: 'holding.not_matured', message: 'Holding has not matured',
});

/**
 * A market value for a fixed-term Holding, valued by its contract (OQ-51).
 *
 * @returns `holding.not_market_priced`.
 */
export const holdingNotMarketPriced = (): DomainError => createDomainError({
  code: 'holding.not_market_priced', message: 'Holding is not market-priced',
});

/**
 * Why ValuationSnapshotAccessor refused a manual change, as the API answers it.
 *
 * @param refusal - `not_found` (not this Holding's) or `automatic` (OQ-56).
 * @returns `snapshot.not_found` or `snapshot.automatic_not_editable`.
 */
export const snapshotRefused = (refusal: ManualRefusal): DomainError => (
  refusal === 'not_found'
    ? createDomainError({ code: 'snapshot.not_found', message: 'Snapshot not found' })
    : createDomainError({
      code: 'snapshot.automatic_not_editable',
      message: 'Automatic snapshots change only with their transaction',
    })
);

/**
 * An index value of another household or index, or none (OQ-172).
 *
 * @returns `index_rate.not_found`.
 */
export const indexRateNotFound = (): DomainError => createDomainError({
  code: 'index_rate.not_found', message: 'Index value not found',
});

/**
 * A second value for an index's day (OQ-172).
 *
 * @returns `index_rate.duplicate_day`.
 */
export const indexRateDuplicateDay = (): DomainError => createDomainError({
  code: 'index_rate.duplicate_day', message: 'Index already has a value that day',
});
