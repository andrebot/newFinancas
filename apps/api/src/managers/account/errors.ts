import type { BudgetTarget } from '../../accessors/budgetAccessor';
import type { ManualRefusal } from '../../accessors/valuationSnapshotAccessor';
import type { StyleRefusal } from '../../accessors/categoryAccessor';
import { createApiError, validationFailed, type ApiError } from '../../http/apiError';

// AccountManager's rejections, in the contract's codes (OQ-114): the Manager
// turns an Accessor's refusal into the API's answer.

/**
 * A Category that isn't this household's, or doesn't exist.
 *
 * @returns 404 `category.not_found`.
 */
export const categoryNotFound = (): ApiError => createApiError({
  status: 404, code: 'category.not_found', message: 'Category not found',
});

/**
 * A Subcategory that isn't under this Category (OQ-173).
 *
 * @returns 404 `subcategory.not_found`.
 */
export const subcategoryNotFound = (): ApiError => createApiError({
  status: 404, code: 'subcategory.not_found', message: 'Subcategory not found',
});

/**
 * An icon or colour outside the in-code sets, refused by CategoryAccessor as a
 * second line behind the contract's enums (OQ-173) — answered like the route's
 * own enum check, on the field.
 *
 * @param refusal - `invalid_icon` or `invalid_color`.
 * @returns 422 `validation.failed` on `icon` or `color`.
 */
export const invalidCategoryStyle = (refusal: StyleRefusal): ApiError => validationFailed([{
  field: refusal === 'invalid_icon' ? 'icon' : 'color', code: 'field.invalid_option',
}]);

/**
 * An Account that isn't this household's, doesn't exist, or is someone else's
 * personal one — the same answer, so it never confirms one exists.
 *
 * @returns 404 `account.not_found`.
 */
export const accountNotFound = (): ApiError => createApiError({
  status: 404, code: 'account.not_found', message: 'Account not found',
});

/**
 * A Credit Card not on this Account, or on an Account the caller can't see.
 *
 * @returns 404 `credit_card.not_found`.
 */
export const creditCardNotFound = (): ApiError => createApiError({
  status: 404, code: 'credit_card.not_found', message: 'Credit card not found',
});

/**
 * An edit of an archived Account: archiving is one-way (FR-2.4, OQ-175).
 *
 * @returns 409 `account.archived`.
 */
export const accountArchived = (): ApiError => createApiError({
  status: 409, code: 'account.archived', message: 'Account is archived',
});

/**
 * A card attached to an Account type that takes none (FR-2.7).
 *
 * @returns 422 `account.cards_not_allowed`.
 */
export const cardsNotAllowed = (): ApiError => createApiError({
  status: 422, code: 'account.cards_not_allowed', message: 'This account type takes no cards',
});

/**
 * A Budget that isn't this household's, doesn't exist (a hard delete leaves
 * nothing), or is someone else's personal one (OQ-176).
 *
 * @returns 404 `budget.not_found`.
 */
export const budgetNotFound = (): ApiError => createApiError({
  status: 404, code: 'budget.not_found', message: 'Budget not found',
});

/**
 * A target another Budget in the scope already claims (FR-4.7). The claimant is
 * always one the caller can see: it sits in the same scope (OQ-176).
 *
 * @param target - The refused claim.
 * @param budgetId - The Budget claiming it.
 * @returns 409 `budget.target_already_claimed`, naming the target and the Budget.
 */
export const targetAlreadyClaimed = (target: BudgetTarget, budgetId: string): ApiError => (
  createApiError({
    status: 409,
    code: 'budget.target_already_claimed',
    message: 'Target already claimed by another budget',
    params: { ...target, budgetId },
  })
);

/**
 * A Goal that isn't this household's, doesn't exist (a hard delete leaves
 * nothing), or is someone else's personal one (OQ-177).
 *
 * @returns 404 `goal.not_found`.
 */
export const goalNotFound = (): ApiError => createApiError({
  status: 404, code: 'goal.not_found', message: 'Goal not found',
});

/**
 * A completed Goal given a bigger share, or a new one (FR-8.9, OQ-168).
 *
 * @returns 409 `goal.completed`.
 */
export const goalCompleted = (): ApiError => createApiError({
  status: 409, code: 'goal.completed', message: 'A completed goal takes no new funding',
});

/**
 * A Holding split past 100% (FR-8.3).
 *
 * @param current - The Holding's total before.
 * @param requested - The refused total, hidden shares included (OQ-178).
 * @returns 409 `goal.allocation_exceeds_100` with both totals.
 */
export const allocationExceeds100 = (current: number, requested: number): ApiError => (
  createApiError({
    status: 409,
    code: 'goal.allocation_exceeds_100',
    message: 'Allocations would exceed 100%',
    params: { current, requested },
  })
);

/**
 * A Holding that isn't this household's, doesn't exist, or sits in someone
 * else's personal Account (OQ-178).
 *
 * @returns 404 `holding.not_found`.
 */
export const holdingNotFound = (): ApiError => createApiError({
  status: 404, code: 'holding.not_found', message: 'Holding not found',
});

/**
 * A change to an archived Holding: archiving is one-way (FR-5.8, OQ-178).
 *
 * @returns 409 `holding.archived`.
 */
export const holdingArchived = (): ApiError => createApiError({
  status: 409, code: 'holding.archived', message: 'Holding is archived',
});

/**
 * A manual archive of a Holding that isn't fixed-term, past due and still
 * holding a position (FR-5.8, OQ-178).
 *
 * @returns 409 `holding.not_matured`.
 */
export const holdingNotMatured = (): ApiError => createApiError({
  status: 409, code: 'holding.not_matured', message: 'Holding has not matured',
});

/**
 * A market value for a fixed-term Holding, valued by its contract (OQ-51).
 *
 * @returns 409 `holding.not_market_priced`.
 */
export const holdingNotMarketPriced = (): ApiError => createApiError({
  status: 409, code: 'holding.not_market_priced', message: 'Holding is not market-priced',
});

/**
 * Why ValuationSnapshotAccessor refused a manual change, as the API answers it.
 *
 * @param refusal - `not_found` (not this Holding's) or `automatic` (OQ-56).
 * @returns 404 `snapshot.not_found` or 409 `snapshot.automatic_not_editable`.
 */
export const snapshotRefused = (refusal: ManualRefusal): ApiError => (
  refusal === 'not_found'
    ? createApiError({ status: 404, code: 'snapshot.not_found', message: 'Snapshot not found' })
    : createApiError({
      status: 409,
      code: 'snapshot.automatic_not_editable',
      message: 'Automatic snapshots change only with their transaction',
    })
);

/**
 * An index value of another household or index, or none (OQ-172).
 *
 * @returns 404 `index_rate.not_found`.
 */
export const indexRateNotFound = (): ApiError => createApiError({
  status: 404, code: 'index_rate.not_found', message: 'Index value not found',
});

/**
 * A second value for an index's day (OQ-172).
 *
 * @returns 409 `index_rate.duplicate_day`.
 */
export const indexRateDuplicateDay = (): ApiError => createApiError({
  status: 409, code: 'index_rate.duplicate_day', message: 'Index already has a value that day',
});
