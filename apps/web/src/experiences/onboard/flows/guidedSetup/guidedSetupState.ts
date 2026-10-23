import type { Account } from '@financas/api-types';
import type {
  AccountActionOutcome, AccountsOutcome, AccountsView,
} from '../../../accountSetup/flows/accountManagement/accountManagementState';
import type { BudgetsView, CategoriesView } from '../../../accountSetup/sharedLists';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// The Guided Setup Flow's state (FL6, mockups 11–14; FR-1.22, OQ-196): which
// step is open, the household's accounts — loaded once, then grown by each
// create — what is out, the last failure for the open form's banner, and the
// budget step's form: which budget it edits, a key that clears it for the next
// one, and the confirm before an unsaved budget is dropped. The account step
// can't be left until the household has an account; the other two can.

/** The wizard's steps, then the summary. */
export type SetupStep = 'account' | 'categories' | 'budget' | 'complete';

/** A step the stepper lists: every one but the summary. */
export type SteppedStep = Exclude<SetupStep, 'complete'>;

/** The steps the stepper lists (the summary isn't one). */
export const STEPPED: readonly SteppedStep[] = ['account', 'categories', 'budget'];

/** Where the summary sends the user next (mockup 14). */
export type SetupDestination = 'dashboard' | 'transactions' | 'household' | 'goals';

/** The request that is out, if any: one at a time. */
export type Outgoing = 'account' | 'budget';

/** The Flow's accumulated state. */
export interface GuidedSetupState {
  readonly step: SetupStep;
  readonly accounts: AccountsView;
  /** Counts the accounts' fetches: a retry bumps it, and the Flow fetches again. */
  readonly accountsLoad: number;
  readonly out?: Outgoing | undefined;
  /** The last request's failure, shown in the open form until it moves on. */
  readonly lastError?: RequestFailure | undefined;
  /** The account form is open beside the accounts already added. */
  readonly addingAccount: boolean;
  /** The budget the budget step's form edits; a create has none. */
  readonly editingBudgetId?: string | undefined;
  /** Changes whenever the budget form must start afresh. */
  readonly budgetFormKey: number;
  /** "Discard the unsaved budget?" is asked under the budget form. */
  readonly discardConfirmOpen: boolean;
}

/** The Flow as it opens: the account step, the accounts loading. */
export const INITIAL_GUIDED_SETUP: GuidedSetupState = {
  step: 'account',
  accounts: { status: 'loading' },
  accountsLoad: 0,
  addingAccount: false,
  budgetFormKey: 0,
  discardConfirmOpen: false,
};

/**
 * Asks for the accounts again (a retry): they show as loading, and the bumped
 * count has the Flow fetch them.
 *
 * @param state - The current state.
 * @returns The state while they are fetched.
 */
export const loadingAccounts = (state: GuidedSetupState): GuidedSetupState => ({
  ...state, accounts: { status: 'loading' }, accountsLoad: state.accountsLoad + 1,
});

/**
 * Applies the Experience's answer for the accounts.
 *
 * @param state - The state while they were fetched.
 * @param outcome - The accounts, or why they failed.
 * @returns The loaded list, or its failure.
 */
export const afterAccountsLoad = (
  state: GuidedSetupState,
  outcome: AccountsOutcome,
): GuidedSetupState => ({
  ...state,
  accounts: outcome.ok
    ? { status: 'loaded', accounts: outcome.data }
    : { status: 'failed', error: outcome.error },
});

/**
 * Lists the accounts still in use.
 *
 * @param view - The accounts' view.
 * @returns Those not archived; none until they load.
 */
export const liveAccountsOf = (view: AccountsView): readonly Account[] => (
  view.status === 'loaded' ? view.accounts.filter((account) => account.archivedAt === null) : []
);

/**
 * Tells whether the household has an account: the account step's way on (FR-1.22).
 *
 * @param state - The current state.
 * @returns Whether one is in use.
 */
export const hasAccount = (state: GuidedSetupState): boolean => (
  liveAccountsOf(state.accounts).length > 0
);

/**
 * Tells whether the account step shows its form: once the accounts have
 * loaded — so a household that has some never sees it flash up, and a create
 * never stands in for a list that failed — always until there is an account,
 * then only once the user asks to add another.
 *
 * @param state - The current state.
 * @returns Whether the form shows.
 */
export const showsAccountForm = (state: GuidedSetupState): boolean => (
  state.accounts.status === 'loaded' && (!hasAccount(state) || state.addingAccount)
);

/**
 * Moves to a step, leaving the last one's form, failure and confirm behind.
 *
 * @param state - The current state.
 * @param step - The step to open.
 * @returns The state on that step.
 */
export const stepMoved = (state: GuidedSetupState, step: SetupStep): GuidedSetupState => ({
  ...state,
  step,
  lastError: undefined,
  addingAccount: false,
  editingBudgetId: undefined,
  discardConfirmOpen: false,
  budgetFormKey: state.budgetFormKey + 1,
});

/** The step after each one; the summary stays put. */
const NEXT: Readonly<Record<SetupStep, SetupStep>> = {
  account: 'categories', categories: 'budget', budget: 'complete', complete: 'complete',
};

/** The step before each one; the first stays put. */
const PREVIOUS: Readonly<Record<SetupStep, SetupStep>> = {
  account: 'account', categories: 'account', budget: 'categories', complete: 'budget',
};

/**
 * The step after one; the summary stays put.
 *
 * @param step - The current step.
 * @returns The next one.
 */
export const nextStep = (step: SetupStep): SetupStep => NEXT[step];

/**
 * The step before one; the first stays put.
 *
 * @param step - The current step.
 * @returns The previous one.
 */
export const previousStep = (step: SetupStep): SetupStep => PREVIOUS[step];

/**
 * Opens or closes the account form beside the accounts already added.
 *
 * @param state - The current state.
 * @param open - Whether it opens.
 * @returns The state with the form open or closed, without the last failure.
 */
export const accountFormToggled = (state: GuidedSetupState, open: boolean): GuidedSetupState => ({
  ...state, addingAccount: open, lastError: undefined,
});

/**
 * Marks a request as out.
 *
 * @param state - The current state.
 * @param out - Which one.
 * @returns The state while it is out, the last failure cleared.
 */
export const started = (state: GuidedSetupState, out: Outgoing): GuidedSetupState => ({
  ...state, out, lastError: undefined,
});

/**
 * Adds a created account to the loaded list. The form only shows once the
 * list has loaded, so there is always one to add it to.
 *
 * @param view - The accounts' view.
 * @param account - The account the API wrote, if it answered one.
 * @returns The view with it, or as it was.
 */
const withAccount = (view: AccountsView, account: Account | undefined): AccountsView => (
  account !== undefined && view.status === 'loaded'
    ? { ...view, accounts: [...view.accounts, account] }
    : view
);

/**
 * Applies a create's answer: on success the account joins the list and the
 * categories step opens; on a failure the form stays with its banner.
 *
 * @param state - The state while the create was out.
 * @param outcome - The Experience's answer.
 * @returns The state after it.
 */
export const afterAccountCreate = (
  state: GuidedSetupState,
  outcome: AccountActionOutcome,
): GuidedSetupState => {
  const settled = { ...state, out: undefined };
  if (!outcome.ok) return { ...settled, lastError: outcome.error };
  const accounts = withAccount(state.accounts, outcome.data);
  return stepMoved({ ...settled, accounts }, 'categories');
};

/**
 * Applies a budget create's or edit's answer: on success the form starts
 * afresh for the next budget; on a failure it keeps what was typed.
 *
 * @param state - The state while the write was out.
 * @param outcome - The Experience's answer.
 * @returns The state after it.
 */
export const afterBudgetWrite = (
  state: GuidedSetupState,
  outcome: RequestOutcome,
): GuidedSetupState => {
  const settled = { ...state, out: undefined };
  if (!outcome.ok) return { ...settled, lastError: outcome.error };
  return {
    ...settled, editingBudgetId: undefined, budgetFormKey: state.budgetFormKey + 1,
  };
};

/**
 * Loads a budget into the budget form, or back to a create with nothing.
 *
 * @param state - The current state.
 * @param budgetId - The budget to edit; nothing for a fresh create.
 * @returns The state with the form starting afresh.
 */
export const budgetFormOpened = (
  state: GuidedSetupState,
  budgetId: string | undefined,
): GuidedSetupState => ({
  ...state,
  editingBudgetId: budgetId,
  budgetFormKey: state.budgetFormKey + 1,
  lastError: undefined,
  discardConfirmOpen: false,
});

/**
 * Asks to finish: a budget typed but not saved is asked about first;
 * otherwise the summary opens.
 *
 * @param state - The current state.
 * @param unsaved - Whether the budget form holds something not saved.
 * @returns The state with the confirm open, or on the summary.
 */
export const finishRequested = (state: GuidedSetupState, unsaved: boolean): GuidedSetupState => (
  unsaved ? { ...state, discardConfirmOpen: true } : stepMoved(state, 'complete')
);

/**
 * Closes the discard confirm: the form keeps what was typed.
 *
 * @param state - The current state.
 * @returns The state without the confirm.
 */
export const discardCancelled = (state: GuidedSetupState): GuidedSetupState => ({
  ...state, discardConfirmOpen: false,
});

/** What the summary counts (mockup 14). */
export interface SetupSummary {
  readonly accounts: number;
  readonly cards: number;
  readonly categories: number;
  readonly budgets: number;
}

/**
 * Counts what the household was set up with: accounts and their cards,
 * categories in use, and the budgets the caller can see. A list that isn't
 * loaded counts nothing.
 *
 * @param accounts - The accounts' view.
 * @param categories - The categories' view.
 * @param budgets - The budgets' view.
 * @returns The counts.
 */
export const summaryOf = (
  accounts: AccountsView,
  categories: CategoriesView,
  budgets: BudgetsView,
): SetupSummary => {
  const live = liveAccountsOf(accounts);
  return {
    accounts: live.length,
    cards: live.reduce((total, account) => total + account.cards.length, 0),
    categories: categories.status === 'loaded'
      ? categories.categories.filter((category) => category.archivedAt === null).length
      : 0,
    budgets: budgets.status === 'loaded' ? budgets.budgets.length : 0,
  };
};
