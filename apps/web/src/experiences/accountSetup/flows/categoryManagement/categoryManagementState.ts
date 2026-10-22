import type { Category, CategoryColor, CategoryIcon } from '@financas/api-types';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import type { CategoriesView } from '../../sharedLists';

// The Category Management Flow's state (FL12; OQ-193): the request that is
// out, the open form card (create, or edit one category in place), the
// archive confirm inside a card and the last form failure. The category list
// itself is the Account Setup Experience's — shared with Budget Management
// (EBD) — and comes in as display state; after a write the Experience answers
// once the list is fetched again, so the Flow never patches it. The
// transitions are pure so the Flow's rules test without React.

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

/** The list as the Experience holds it (OQ-193). */
export type { CategoriesView };

/** The form card that is open, if any (mockup 41's dashed card). */
export type OpenForm = { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly categoryId: string };

/** The Flow's accumulated state. */
export interface CategoryManagementState {
  /** Its control spins and the others wait while it is out. */
  readonly out?: Outgoing | undefined;
  readonly form?: OpenForm | undefined;
  /** The archive confirm open inside a card, by category id. */
  readonly archiving?: string | undefined;
  /** The last create's or edit's failure, for the open form's banner. */
  readonly lastError?: RequestFailure | undefined;
  /**
   * The toast owed for an edit form closed because its category was archived
   * meanwhile (OQ-194): a fresh object each time, so it is toasted once.
   */
  readonly notice?: { readonly message: string } | undefined;
}

/** The Flow as it opens: nothing out, nothing open. */
export const INITIAL_CATEGORIES: CategoryManagementState = {};

/**
 * Tells a form's request from a card's: a form shows its failure in its
 * banner, a card's action is toasted (OQ-193).
 *
 * @param outgoing - The request.
 * @returns Whether it came from a form card.
 */
export const isFormRequest = (outgoing: Outgoing): boolean => (
  outgoing.kind === 'create' || outgoing.kind === 'edit'
);

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
): CategoryManagementState => ({
  ...state, archiving: categoryId, form: undefined, lastError: undefined,
});

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
 * Finds the category an open archive confirm is about.
 *
 * @param view - The Experience's list.
 * @param archiving - The confirm's category id, if one is open.
 * @returns The category, or nothing while no confirm is open or the list isn't loaded.
 */
export const archivingTarget = (
  view: CategoriesView,
  archiving: string | undefined,
): Category | undefined => {
  if (archiving === undefined || view.status !== 'loaded') return undefined;
  return view.categories.find((category) => category.id === archiving);
};

/**
 * Finds the category an open edit form outlived: archived by someone else and
 * seen in a list fetched again for another reason (a retry, another card's
 * write). Its card has left the live grid, so the form can't stay (OQ-194).
 * Nothing while a request is out: its answer decides what the form does.
 *
 * @param state - The Flow's state.
 * @param view - The Experience's list.
 * @returns The archived category under the open edit form, or nothing.
 */
export const archivedUnderForm = (
  state: CategoryManagementState,
  view: CategoriesView,
): Category | undefined => {
  const { form } = state;
  if (form?.mode !== 'edit' || state.out || view.status !== 'loaded') return undefined;
  const edited = view.categories.find((category) => category.id === form.categoryId);
  return edited?.archivedAt ? edited : undefined;
};

/**
 * Closes an edit form its category outlived, owing a toast that says why.
 *
 * @param state - The current state.
 * @param message - The toast's text, already translated.
 * @returns The state with no form open and the notice to toast.
 */
export const formOutlived = (
  state: CategoryManagementState,
  message: string,
): CategoryManagementState => ({
  ...formClosed(state), notice: { message },
});

/**
 * Applies the Experience's answer for the request that was out. A success
 * closes whatever form or confirm it came from — the list already holds it; a
 * form's failure keeps the form and its typing and shows why in its banner; a
 * card's failure keeps its confirm open and is toasted by the Flow.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterAction = (
  state: CategoryManagementState,
  outcome: RequestOutcome,
): CategoryManagementState => {
  const { out } = state;
  if (!out) return state;
  if (!outcome.ok) {
    return { ...state, out: undefined, lastError: isFormRequest(out) ? outcome.error : undefined };
  }
  return {
    ...state,
    out: undefined,
    ...(isFormRequest(out) ? { form: undefined } : {}),
    ...(out.kind === 'archiveCategory' ? { archiving: undefined } : {}),
    lastError: undefined,
  };
};

/**
 * Tells whether a role may create a category in the household: everyone but
 * a Viewer. Categories are shared data nobody owns, so the permission table
 * applies as is (FR-1.7): a Member creates, but only an Owner or Admin
 * manages afterwards — a Member can't add subcategories to what they made.
 *
 * @param role - The actor's role.
 * @returns Whether the Add Category button shows.
 */
export const mayCreateCategory = (role: string | undefined) => (
  role !== undefined && role !== 'Viewer'
);

/**
 * Tells whether a role may edit or archive categories and their subcategories
 * in the household (FR-1.7): Owner/Admin only.
 *
 * @param role - The actor's role.
 * @returns Whether the manage controls show on its cards.
 */
export const mayManageCategories = (role: string | undefined) => (
  role === 'Owner' || role === 'Admin'
);
