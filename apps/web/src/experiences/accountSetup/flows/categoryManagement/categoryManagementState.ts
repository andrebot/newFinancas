import type { Category, CategoryColor, CategoryIcon } from '@financas/api-types';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// The Category Management Flow's state (FL12; OQ-173/174): the household's
// categories as the Flow last fetched them — archived included, split for the
// panels — the request that is out, the open form card (create, or edit one
// category in place) and the archive confirm inside a card. The transitions
// are pure so the Flow's rules test without React. A success changes the list
// the way the API did — create appends the returned category, an edit or a
// subcategory add replaces with the server's copy, an archive stamps
// `archivedAt` locally (a category's cascade included) — so nothing is fetched
// again; the Experience's tag invalidation keeps the cache in step behind it.

/** What the create form emits (FR-10.1). */
export interface NewCategory {
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: CategoryColor;
}

/** What the edit form emits: its category and the fields as they stand. */
export interface CategoryEdit {
  readonly categoryId: string;
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: CategoryColor;
}

/** The request that is out, if any. */
export type Outgoing = { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly categoryId: string }
  | { readonly kind: 'archiveCategory'; readonly categoryId: string }
  | { readonly kind: 'addSubcategory'; readonly categoryId: string }
  | {
    readonly kind: 'archiveSubcategory';
    readonly categoryId: string;
    readonly subcategoryId: string;
  };

/** What the Experience answers for the list. */
export type CategoriesOutcome = { readonly ok: true; readonly categories: readonly Category[] }
  | { readonly ok: false; readonly error: RequestFailure };

/** The panels' content, archived included (FR-10.3). */
export type CategoriesView = { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: RequestFailure }
  | { readonly status: 'loaded'; readonly categories: readonly Category[] };

/** The form card that is open, if any (mockup 41's dashed card). */
export type OpenForm = { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly categoryId: string };

/** The Flow's accumulated state. */
export interface CategoryManagementState {
  readonly view: CategoriesView;
  /** Its control spins and the others wait while it is out. */
  readonly out?: Outgoing | undefined;
  readonly form?: OpenForm | undefined;
  /** The archive confirm open inside a card, by category id. */
  readonly archiving?: string | undefined;
  /** The last request's failure, shown until the next one goes out. */
  readonly lastError?: RequestFailure | undefined;
}

/** The Flow as it opens: the list loading, nothing else. */
export const INITIAL_CATEGORIES: CategoryManagementState = { view: { status: 'loading' } };

/**
 * Marks the list as loading again (a retry). Any open form or confirm closes
 * with it.
 *
 * @param state - The current state.
 * @returns The state while the list is fetched.
 */
export const loadingCategories = (state: CategoryManagementState): CategoryManagementState => ({
  ...state,
  view: { status: 'loading' },
  form: undefined,
  archiving: undefined,
  lastError: undefined,
});

/**
 * Applies the Experience's answer for the list.
 *
 * @param state - The state while the list was fetched.
 * @param outcome - The categories, or why they failed.
 * @returns The loaded list, or the failure and its retry.
 */
export const afterLoad = (
  state: CategoryManagementState,
  outcome: CategoriesOutcome,
): CategoryManagementState => ({
  ...state,
  view: outcome.ok
    ? { status: 'loaded', categories: outcome.categories }
    : { status: 'failed', error: outcome.error },
});

/**
 * Opens a form card.
 *
 * @param state - The current state.
 * @param form - Which one, about which category for an edit.
 * @returns The state with the form open and no archive confirm.
 */
export const formOpened = (
  state: CategoryManagementState,
  form: OpenForm,
): CategoryManagementState => ({
  ...state, form, archiving: undefined, lastError: undefined,
});

/**
 * Closes the open form card and its archive confirm.
 *
 * @param state - The current state.
 * @returns The state with no form open.
 */
export const formClosed = (state: CategoryManagementState): CategoryManagementState => ({
  ...state, form: undefined, archiving: undefined, lastError: undefined,
});

/**
 * Opens a card's archive confirm.
 *
 * @param state - The current state.
 * @param categoryId - Which category is archived on a yes.
 * @returns The state with the confirm open and no form.
 */
export const archiveConfirmOpened = (
  state: CategoryManagementState,
  categoryId: string,
): CategoryManagementState => ({ ...state, archiving: categoryId, form: undefined });

/**
 * Closes the open archive confirm; its card stays.
 *
 * @param state - The current state.
 * @returns The state with no confirm open.
 */
export const archiveConfirmCancelled = (
  state: CategoryManagementState,
): CategoryManagementState => ({ ...state, archiving: undefined });

/**
 * Marks a request as out.
 *
 * @param state - The current state.
 * @param outgoing - Which one.
 * @returns The state while it is out.
 */
export const started = (
  state: CategoryManagementState,
  outgoing: Outgoing,
): CategoryManagementState => ({ ...state, out: outgoing, lastError: undefined });

/**
 * Splits a loaded list into the live categories and its archived ones.
 *
 * @param categories - The household's categories, in any order.
 * @returns Both halves; each keeps its order.
 */
export const splitCategories = (categories: readonly Category[]) => ({
  active: categories.filter((category) => category.archivedAt === null),
  archived: categories.filter((category) => category.archivedAt !== null),
});

/**
 * Lists a category's live subcategories, in order.
 *
 * @param category - The category.
 * @returns Its subcategories that are not archived (FR-10.4).
 */
export const liveSubcategoriesOf = (category: Category) => (
  category.subcategories.filter((subcategory) => subcategory.archivedAt === null)
);

/**
 * Applies a request's success to the loaded list, as the API did.
 *
 * @param view - The loaded list.
 * @param outgoing - The request that succeeded.
 * @param written - The category a create, an edit or a subcategory add returned.
 * @returns The list after it.
 */
const applied = (
  view: Extract<CategoriesView, { status: 'loaded' }>,
  outgoing: Outgoing,
  written?: Category,
): CategoriesView => {
  if (outgoing.kind === 'create') {
    return written ? { ...view, categories: [...view.categories, written] } : view;
  }
  if (outgoing.kind === 'edit' || outgoing.kind === 'addSubcategory') {
    return written
      ? {
        ...view,
        categories: view.categories.map((category) => (
          category.id === written.id ? written : category
        )),
      }
      : view;
  }
  const archivedAt = new Date().toISOString();
  if (outgoing.kind === 'archiveCategory') {
    return {
      ...view,
      categories: view.categories.map((category) => (
        category.id === outgoing.categoryId && category.archivedAt === null
          ? {
            ...category,
            archivedAt,
            subcategories: category.subcategories.map((subcategory) => (
              subcategory.archivedAt === null ? { ...subcategory, archivedAt } : subcategory
            )),
          }
          : category
      )),
    };
  }
  return {
    ...view,
    categories: view.categories.map((category) => (
      category.id !== outgoing.categoryId
        ? category
        : {
          ...category,
          subcategories: category.subcategories.map((subcategory) => (
            subcategory.id === outgoing.subcategoryId && subcategory.archivedAt === null
              ? { ...subcategory, archivedAt }
              : subcategory
          )),
        }
    )),
  };
};

/**
 * Applies the Experience's answer for the request that was out. A success
 * changes the list and closes whatever form or confirm it came from; a failure
 * keeps everything so a form still holds what was typed (and shows why).
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer (a create/edit/add carries its category).
 * @returns The next state.
 */
export const afterAction = (
  state: CategoryManagementState,
  outcome: RequestOutcome & { readonly category?: Category | undefined },
): CategoryManagementState => {
  const { out, view } = state;
  if (!out) return state;
  if (!outcome.ok) return { ...state, out: undefined, lastError: outcome.error };
  const nextView = view.status === 'loaded'
    ? applied(view, out, outcome.category)
    : view;
  const closesForm = out.kind === 'create' || out.kind === 'edit';
  return {
    ...state,
    view: nextView,
    out: undefined,
    ...(closesForm ? { form: undefined } : {}),
    ...(out.kind === 'archiveCategory' ? { archiving: undefined } : {}),
    lastError: undefined,
  };
};

/**
 * Tells whether a role may create a category in the household (FR-1.7,
 * OQ-174): everyone but a Viewer.
 *
 * @param role - The actor's role.
 * @returns Whether the Add Category button shows.
 */
export const mayCreateCategory = (role: string | undefined) => (
  role !== undefined && role !== 'Viewer'
);

/**
 * Tells whether a role may edit or archive categories and their subcategories
 * in the household (FR-1.7, OQ-174): Owner/Admin only.
 *
 * @param role - The actor's role.
 * @returns Whether the manage controls show on its cards.
 */
export const mayManageCategories = (role: string | undefined) => (
  role === 'Owner' || role === 'Admin'
);
