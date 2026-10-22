import type { Budget, BudgetTargetInput, Currency } from '@financas/api-types';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import type { BudgetsView } from '../../sharedLists';
import type { Visibility } from './claims';

// The Budget Management Flow's state (FL13; OQ-176, OQ-194): the request that
// is out, the open drawer (create, or edit one budget), the delete confirm
// inside the edit drawer and the last form failure. The budgets and the categories are the
// Account Setup Experience's and come in as display state; after a write the
// Experience answers once the budgets are fetched again — claims are shared
// state other members change, so the list is always the server's — and the
// Flow never patches it. The transitions are pure so the rules test without React.

export type { BudgetsView };

/** What the create form emits (FR-4.1, FR-4.2). */
export interface NewBudget {
  readonly name: string;
  /** Minor units, more than zero (OQ-176). */
  readonly targetAmount: number;
  readonly currency: Currency;
  readonly visibility: Visibility;
  readonly targets: BudgetTargetInput[];
}

/** What the edit form emits: currency and visibility never change (OQ-176). */
export interface BudgetEdit {
  readonly budgetId: string;
  readonly name: string;
  readonly targetAmount: number;
  /** The whole set, replacing the one held (OQ-176). */
  readonly targets: BudgetTargetInput[];
}

/** The request that is out, if any. */
export type Outgoing = { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly budgetId: string }
  | { readonly kind: 'delete'; readonly budgetId: string };

/** The drawer that is open, if any. */
export type OpenDrawer = { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly budgetId: string };

/** The Flow's accumulated state. */
export interface BudgetManagementState {
  /** Its control spins and the others wait while it is out. */
  readonly out?: Outgoing | undefined;
  readonly drawer?: OpenDrawer | undefined;
  /** The delete confirm open inside the edit drawer, by budget id. */
  readonly deleting?: string | undefined;
  /** The last create's or edit's failure, for the open drawer's banner. */
  readonly lastError?: RequestFailure | undefined;
}

/** The Flow as it opens: nothing out, nothing open. */
export const INITIAL_BUDGETS: BudgetManagementState = {};

/**
 * Opens a drawer; any delete confirm closes.
 *
 * @param state - The current state.
 * @param drawer - Which one, about which budget for an edit.
 * @returns The state with the drawer open.
 */
export const drawerOpened = (
  state: BudgetManagementState,
  drawer: OpenDrawer,
): BudgetManagementState => ({
  ...state, drawer, deleting: undefined, lastError: undefined,
});

/**
 * Closes the open drawer and its delete confirm — unless a request is out: it
 * then stays, so a failure still has its banner to show in (as OQ-192).
 *
 * @param state - The current state.
 * @returns The state with no drawer, or as it was while a request is out.
 */
export const drawerClosed = (state: BudgetManagementState): BudgetManagementState => (
  state.out ? state : {
    ...state, drawer: undefined, deleting: undefined, lastError: undefined,
  }
);

/**
 * Opens the delete confirm inside the edit drawer, about its budget.
 *
 * @param state - The current state.
 * @returns The state with the confirm open, or as it was with no edit drawer open.
 */
export const deleteConfirmOpened = (state: BudgetManagementState): BudgetManagementState => (
  state.drawer?.kind === 'edit' ? { ...state, deleting: state.drawer.budgetId } : state
);

/**
 * Closes the open delete confirm; the drawer stays.
 *
 * @param state - The current state.
 * @returns The state with no confirm open.
 */
export const deleteConfirmCancelled = (state: BudgetManagementState): BudgetManagementState => ({
  ...state, deleting: undefined,
});

/**
 * Marks a request as out.
 *
 * @param state - The current state.
 * @param outgoing - Which one.
 * @returns The state while it is out.
 */
export const started = (
  state: BudgetManagementState,
  outgoing: Outgoing,
): BudgetManagementState => ({ ...state, out: outgoing, lastError: undefined });

/**
 * Tells whether a failure says the edited budget is gone: deleted meanwhile
 * (404). The list fetched again no longer holds it, so its drawer has nothing
 * left to show a banner about (OQ-194).
 *
 * @param out - The request that was out.
 * @param failure - Why it failed.
 * @returns Whether it was an edit of a budget that no longer exists.
 */
export const isEditOfGone = (out: Outgoing, failure: RequestFailure): boolean => (
  out.kind === 'edit' && failure.code === 'budget.not_found'
);

/**
 * Tells whether the Flow toasts a failure: a delete's, which has no banner,
 * or an edit's whose budget is gone, whose drawer closes. Any other form
 * failure shows in the drawer's banner instead — once, where it belongs.
 *
 * @param out - The request that was out.
 * @param failure - Why it failed.
 * @returns Whether it is toasted.
 */
export const toastsFailure = (out: Outgoing, failure: RequestFailure): boolean => (
  out.kind === 'delete' || isEditOfGone(out, failure)
);

/**
 * Applies the Experience's answer for the request that was out. A success
 * closes the drawer it came from — a delete's with its confirm, the budget
 * being gone; a form's failure keeps the drawer and its typing and shows why
 * in its banner — unless the edited budget is gone, which closes the drawer
 * (toasted by the Flow); a delete's failure keeps its confirm open and is
 * toasted by the Flow.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterAction = (
  state: BudgetManagementState,
  outcome: RequestOutcome,
): BudgetManagementState => {
  const { out } = state;
  if (!out) return state;
  const isForm = out.kind !== 'delete';
  if (!outcome.ok) {
    if (isEditOfGone(out, outcome.error)) {
      return {
        ...state, out: undefined, drawer: undefined, lastError: undefined,
      };
    }
    return { ...state, out: undefined, lastError: isForm ? outcome.error : undefined };
  }
  return {
    ...state, out: undefined, drawer: undefined, deleting: undefined, lastError: undefined,
  };
};

/**
 * Finds a budget in the loaded list.
 *
 * @param view - The Experience's list.
 * @param budgetId - The budget, if one is asked for.
 * @returns It, or nothing while the list isn't loaded or it is gone.
 */
export const budgetIn = (view: BudgetsView, budgetId: string | undefined): Budget | undefined => {
  if (budgetId === undefined || view.status !== 'loaded') return undefined;
  return view.budgets.find((budget) => budget.id === budgetId);
};
