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
