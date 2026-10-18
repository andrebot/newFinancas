import type { BudgetTarget } from '../../accessors/budgetAccessor';
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
