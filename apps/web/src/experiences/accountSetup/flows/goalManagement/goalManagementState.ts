import type { Currency, Goal } from '@financas/api-types';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import type { GoalEntry, GoalsView } from '../../sharedLists';
import { pairKey, type EnteredRates, type RatePair } from './goalProgress';

// The Goal Management Flow's state (FL14; FR-8, OQ-177, OQ-195): which status
// is shown, the request that is out, the open drawer (create, or edit one
// goal), the inline confirm open in the edit drawer (complete, reopen or
// delete — OQ-195), the last form failure, and the exchange rates typed — kept here only, never
// sent (FR-9.1). The goals are the Account Setup Experience's and come in as
// display state; after a write the Experience answers once they are fetched
// again, and the Flow never patches them. The transitions are pure so the
// rules test without React.

export type { GoalsView };

/** Which goals are listed (mockup 43's Active / Completed). */
export type GoalStatus = 'active' | 'completed';

/** What the create form emits (FR-8.1). */
export interface NewGoal {
  readonly name: string;
  /** Minor units of `targetCurrency`, more than zero (OQ-177). */
  readonly targetAmount: number;
  readonly targetCurrency: Currency;
  /** `YYYY-MM-DD`; a past date is allowed (OQ-177). */
  readonly dueDate: string;
  readonly visibility: Goal['visibility'];
}

/** What the edit form emits: the visibility never changes (OQ-177). */
export type GoalEdit = Omit<NewGoal, 'visibility'> & { readonly goalId: string };

/** The steps the edit drawer asks to confirm inline (OQ-195). */
export type GoalAction = 'complete' | 'reopen' | 'delete';

/** The request that is out, if any. */
export type Outgoing = { readonly kind: 'create' }
  | { readonly kind: 'edit' | GoalAction; readonly goalId: string };

/** The drawer that is open, if any. */
export type OpenDrawer = { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly goalId: string };

/** The Flow's accumulated state. */
export interface GoalManagementState {
  readonly status: GoalStatus;
  /** Its control spins and the others wait while it is out. */
  readonly out?: Outgoing | undefined;
  readonly drawer?: OpenDrawer | undefined;
  /** The step whose confirm is open in the edit drawer, about its goal. */
  readonly confirm?: GoalAction | undefined;
  /** The last create's or edit's failure, for the open drawer's banner. */
  readonly lastError?: RequestFailure | undefined;
  /** The rates typed, × 10,000, by pair (FR-9.1): never sent. */
  readonly rates: EnteredRates;
}

/** The Flow as it opens: the active goals, nothing out, nothing open, no rates. */
export const INITIAL_GOALS: GoalManagementState = { status: 'active', rates: {} };

/**
 * Shows the other status's goals — not while a request is out.
 *
 * @param state - The current state.
 * @param status - The status to show.
 * @returns The state showing it.
 */
export const statusChanged = (
  state: GoalManagementState,
  status: GoalStatus,
): GoalManagementState => (state.out ? state : { ...state, status });

/**
 * Opens a drawer; any confirm closes.
 *
 * @param state - The current state.
 * @param drawer - Which one, about which goal for an edit.
 * @returns The state with the drawer open.
 */
export const drawerOpened = (
  state: GoalManagementState,
  drawer: OpenDrawer,
): GoalManagementState => ({
  ...state, drawer, confirm: undefined, lastError: undefined,
});

/**
 * Closes the open drawer and its confirm — unless a request is out: it then
 * stays, so a failure still has its banner to show in (as OQ-192).
 *
 * @param state - The current state.
 * @returns The state with no drawer, or as it was while a request is out.
 */
export const drawerClosed = (state: GoalManagementState): GoalManagementState => (
  state.out ? state : {
    ...state, drawer: undefined, confirm: undefined, lastError: undefined,
  }
);

/**
 * Opens a step's inline confirm in the edit drawer, about its goal — one at a
 * time, and not while a request is out.
 *
 * @param state - The current state.
 * @param confirm - The step.
 * @returns The state with the confirm open, or as it was with no edit drawer open.
 */
export const confirmOpened = (
  state: GoalManagementState,
  confirm: GoalAction,
): GoalManagementState => (
  state.out || state.drawer?.kind !== 'edit' ? state : { ...state, confirm }
);

/**
 * Closes the open confirm.
 *
 * @param state - The current state.
 * @returns The state with no confirm open.
 */
export const confirmCancelled = (state: GoalManagementState): GoalManagementState => (
  state.out ? state : { ...state, confirm: undefined }
);

/**
 * Keeps a rate typed for a pair, or forgets it once cleared or zero — a zero
 * rate would divide by zero and converts nothing anyway.
 *
 * @param state - The current state.
 * @param pair - The currency pair.
 * @param rate - The rate × 10,000, or `null` once cleared.
 * @returns The state with the rate.
 */
export const rateEntered = (
  state: GoalManagementState,
  pair: RatePair,
  rate: number | null,
): GoalManagementState => {
  const key = pairKey(pair);
  const others = Object.fromEntries(Object.entries(state.rates).filter(([held]) => held !== key));
  return { ...state, rates: rate ? { ...others, [key]: rate } : others };
};

/**
 * Marks a request as out.
 *
 * @param state - The current state.
 * @param outgoing - Which one.
 * @returns The state while it is out.
 */
export const started = (
  state: GoalManagementState,
  outgoing: Outgoing,
): GoalManagementState => ({ ...state, out: outgoing, lastError: undefined });

/**
 * Tells whether a request is a step behind a confirm (complete, reopen,
 * delete) rather than the drawer's form.
 *
 * @param out - The request.
 * @returns Whether a confirm sent it.
 */
export const isGoalAction = (out: Outgoing): boolean => (
  out.kind !== 'create' && out.kind !== 'edit'
);

/**
 * Tells whether a failure says the goal is gone: deleted meanwhile (404) — or
 * made personal-to-someone-else, which reads the same (OQ-177).
 *
 * @param failure - Why the request failed.
 * @returns Whether its goal no longer exists for the caller.
 */
export const isGone = (failure: RequestFailure): boolean => failure.code === 'goal.not_found';

/**
 * Tells whether the Flow toasts a failure: a confirmed step's, which has no
 * banner, or an edit's whose goal is gone, whose drawer closes. Any other form
 * failure shows in the drawer's banner instead.
 *
 * @param out - The request that was out.
 * @param failure - Why it failed.
 * @returns Whether it is toasted.
 */
export const toastsFailure = (out: Outgoing, failure: RequestFailure): boolean => (
  isGoalAction(out) || (out.kind === 'edit' && isGone(failure))
);

/**
 * Applies the answer to a form's request: a success, or its goal gone, closes
 * the drawer; any other failure keeps it, with its typing, and shows why.
 *
 * @param state - The state while it was out, already cleared of `out`.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
const afterForm = (state: GoalManagementState, outcome: RequestOutcome): GoalManagementState => {
  if (outcome.ok || isGone(outcome.error)) {
    return { ...state, drawer: undefined, lastError: undefined };
  }
  return { ...state, lastError: outcome.error };
};

/**
 * Applies the answer to a confirmed step: a success — the goal moved to the
 * other list, or is gone — or its goal gone meanwhile closes the drawer and
 * its confirm; any other failure keeps both for another try (toasted).
 *
 * @param state - The state while it was out, already cleared of `out`.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
const afterStep = (state: GoalManagementState, outcome: RequestOutcome): GoalManagementState => (
  outcome.ok || isGone(outcome.error)
    ? {
      ...state, drawer: undefined, confirm: undefined, lastError: undefined,
    }
    : state
);

/**
 * Applies the Experience's answer for the request that was out.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterAction = (
  state: GoalManagementState,
  outcome: RequestOutcome,
): GoalManagementState => {
  const { out } = state;
  if (!out) return state;
  const settled = { ...state, out: undefined };
  return isGoalAction(out) ? afterStep(settled, outcome) : afterForm(settled, outcome);
};

/**
 * Lists the goals of one status as the Flow sees them.
 *
 * @param view - The Experience's goals.
 * @param status - Which status.
 * @returns That status's entries, or none while not loaded.
 */
export const entriesOf = (view: GoalsView, status: GoalStatus): readonly GoalEntry[] => {
  const list = view[status];
  return list.status === 'loaded' ? list.goals : [];
};

/**
 * Finds a goal in either status's loaded list.
 *
 * @param view - The Experience's goals.
 * @param goalId - The goal, if one is asked for.
 * @returns It, or nothing while not loaded or once gone.
 */
export const goalIn = (view: GoalsView, goalId: string | undefined): Goal | undefined => {
  if (goalId === undefined) return undefined;
  return [...entriesOf(view, 'active'), ...entriesOf(view, 'completed')]
    .find((entry) => entry.goal.id === goalId)?.goal;
};

/**
 * Reads the two status lists together: failed if either's first load failed,
 * loading while either loads, loaded otherwise — with whether a refetch failed.
 *
 * @param view - The Experience's goals.
 * @returns The joint status, and the staleness once loaded.
 */
export const jointStatusOf = (view: GoalsView) => {
  const lists = [view.active, view.completed];
  if (lists.some((list) => list.status === 'failed')) return { status: 'failed' } as const;
  if (lists.some((list) => list.status === 'loading')) return { status: 'loading' } as const;
  const stale = lists.some((list) => list.status === 'loaded' && list.refreshError !== undefined);
  return { status: 'loaded', stale } as const;
};
