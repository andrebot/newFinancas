import type {
  Category, CategoryChanges, CategoryFilter, EditRefusal, NewCategory, SubcategoryEdit,
} from '../../accessors/categoryAccessor';
import type { DataAction } from '../../utilities/authorization';
import { checkFields, checkItems, nonBlank } from '../../utilities/validation';
import { requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import requireValidFields, { requireNoProblems } from '../validation';
import { requestLogger, type AccountDeps } from './context';
import {
  categoryNotFound, invalidCategoryStyle, subcategoryNotFound,
} from './errors';

// Categories and Subcategories (categories/uc-01..03, FR-10). A Category is
// shared household taxonomy with no recorded creator, so the permission table
// reads it as shared data nobody owns: any member but a Viewer may create one;
// editing and archiving are Owner/Admin (FR-1.7, OQ-111).

/**
 * Checks the caller may take a data action on the household's Categories.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param action - The data action.
 * @throws {ApiError} 404 `household.not_found`; 403 `auth.forbidden`.
 */
const requireCategoryAccess = async (
  deps: AccountDeps,
  context: SignedInContext,
  householdId: string,
  action: DataAction,
): Promise<void> => {
  await requireAccess(deps.authorization, context.actor.userId, householdId, {
    action, visibility: 'shared', ownerUserId: null,
  });
};

/** A Category edit as the route validated it: any field may be left out. */
export interface CategoryEdit {
  readonly name?: string | undefined;
  readonly icon?: string | undefined;
  readonly color?: string | undefined;
  readonly subcategories?: readonly {
    readonly id?: string | undefined;
    readonly name: string;
  }[] | undefined;
}

/**
 * The changes an edit asks for: names trimmed, fields not sent left out.
 *
 * @param edit - The edit, names already checked as non-blank.
 * @returns What CategoryAccessor writes.
 */
export const changesOf = (edit: CategoryEdit): CategoryChanges => {
  const candidates = {
    name: edit.name?.trim(),
    icon: edit.icon,
    color: edit.color,
    subcategories: edit.subcategories?.map(({ id, name }): SubcategoryEdit => (
      id === undefined ? { name: name.trim() } : { id, name: name.trim() }
    )),
  };
  return Object.fromEntries(
    Object.entries(candidates).filter(([, value]) => value !== undefined),
  );
};

/**
 * Turns CategoryAccessor's refusal of an edit into the API's answer.
 *
 * @param refusal - Why nothing was written.
 * @returns The error to throw.
 */
const editRefusalError = (refusal: EditRefusal) => {
  if (refusal === 'not_found') return categoryNotFound();
  if (refusal === 'subcategory_not_found') return subcategoryNotFound();
  return invalidCategoryStyle(refusal);
};

/**
 * Builds the Category use cases.
 *
 * @param deps - The tier below.
 * @returns `listCategories`, `getCategory`, `createCategory`, `editCategory`,
 *   `archiveCategory`, `archiveSubcategory`.
 */
const createCategories = (deps: AccountDeps) => ({
  /**
   * The household's Categories with their Subcategories, open ones first
   * (any member may look).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param filter - Whether archived ones come too.
   * @returns The Categories.
   * @throws {ApiError} 404 `household.not_found`.
   */
  listCategories: async (
    context: SignedInContext,
    householdId: string,
    filter: CategoryFilter,
  ): Promise<Category[]> => {
    await requireCategoryAccess(deps, context, householdId, 'data.view');
    return deps.categories.list(householdId, filter);
  },

  /**
   * One Category with all its Subcategories, archived ones included.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param categoryId - The Category.
   * @returns The Category.
   * @throws {ApiError} 404 `household.not_found` / `category.not_found`.
   */
  getCategory: async (
    context: SignedInContext,
    householdId: string,
    categoryId: string,
  ): Promise<Category> => {
    await requireCategoryAccess(deps, context, householdId, 'data.view');
    const category = await deps.categories.findById(householdId, categoryId);
    if (!category) throw categoryNotFound();
    return category;
  },

  /**
   * Creates a custom Category, with no Subcategories yet (uc-01, FR-10.1).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param category - Its name (trimmed here, must not be blank), icon and colour.
   * @returns The Category.
   * @throws {ApiError} 404 `household.not_found`; 403 `auth.forbidden`; 422
   *   `validation.failed`.
   */
  createCategory: async (
    context: SignedInContext,
    householdId: string,
    category: NewCategory,
  ): Promise<Category> => {
    await requireCategoryAccess(deps, context, householdId, 'data.create');
    requireValidFields(category, { name: nonBlank });
    const created = await deps.categories.insert(
      householdId,
      { ...category, name: category.name.trim() },
    );
    if (typeof created === 'string') throw invalidCategoryStyle(created);
    requestLogger(context).audit('CreateCategory', {
      entityType: 'Category', entityId: created.id, householdId,
    });
    return created;
  },

  /**
   * Edits a Category and its Subcategories in one atomic write (uc-02, FR-10.2,
   * OQ-173): a listed Subcategory with an `id` is renamed, one without is created.
   * An empty edit reads the Category back, unaudited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param categoryId - The Category.
   * @param edit - The fields to change; names are trimmed and must not be blank.
   * @returns The Category as it now stands.
   * @throws {ApiError} 404 `household.not_found` / `category.not_found` /
   *   `subcategory.not_found`; 403 `auth.forbidden`; 422 `validation.failed`.
   */
  editCategory: async (
    context: SignedInContext,
    householdId: string,
    categoryId: string,
    edit: CategoryEdit,
  ): Promise<Category> => {
    await requireCategoryAccess(deps, context, householdId, 'data.edit');
    requireNoProblems([
      ...checkFields(edit, { name: nonBlank }),
      ...checkItems('subcategories', edit.subcategories ?? [], { name: nonBlank }),
    ]);
    const changes = changesOf(edit);
    const edited = await deps.categories.update(householdId, categoryId, changes);
    if (typeof edited === 'string') throw editRefusalError(edited);
    if (Object.keys(changes).length > 0) {
      requestLogger(context).audit('EditCategory', {
        entityType: 'Category', entityId: categoryId, householdId,
      });
    }
    return edited;
  },

  /**
   * Archives a Category, one way, and its live Subcategories with it (uc-03,
   * FR-10.3/10.4).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param categoryId - The Category.
   * @throws {ApiError} 404 `household.not_found` / `category.not_found`; 403
   *   `auth.forbidden`.
   */
  archiveCategory: async (
    context: SignedInContext,
    householdId: string,
    categoryId: string,
  ): Promise<void> => {
    await requireCategoryAccess(deps, context, householdId, 'data.delete');
    if (!(await deps.categories.archive(householdId, categoryId))) throw categoryNotFound();
    requestLogger(context).audit('ArchiveCategory', {
      entityType: 'Category', entityId: categoryId, householdId,
    });
  },

  /**
   * Archives one Subcategory, one way; its Category and siblings are untouched
   * (uc-03, FR-10.3/10.4).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param categoryId - Its Category.
   * @param subcategoryId - The Subcategory.
   * @throws {ApiError} 404 `household.not_found` / `subcategory.not_found`; 403
   *   `auth.forbidden`.
   */
  archiveSubcategory: async (
    context: SignedInContext,
    householdId: string,
    categoryId: string,
    subcategoryId: string,
  ): Promise<void> => {
    await requireCategoryAccess(deps, context, householdId, 'data.delete');
    const archived = await deps.categories.archiveSubcategory(
      householdId,
      categoryId,
      subcategoryId,
    );
    if (!archived) throw subcategoryNotFound();
    requestLogger(context).audit('ArchiveSubcategory', {
      entityType: 'Subcategory', entityId: subcategoryId, householdId,
    });
  },
});

export default createCategories;
