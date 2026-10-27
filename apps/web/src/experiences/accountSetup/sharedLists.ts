import type {
  Budget, Category, Goal, GoalWithProgress,
} from '@financas/api-types';
import type { RequestFailure } from '../../utilities/requestOutcome';

// The lists the Account Setup Experience holds and hands down to its Flows as
// display state (EBD; OQ-193..195): the household's categories — written by
// Category Management, read by Budget Management's picker — the budgets the
// caller can see, and their goals, each joined to its progress. Each is
// fetched again after a write before the Flow is answered; a list whose latest
// fetch failed keeps showing, with that failure beside it, so an open form
// keeps what was typed.

/**
 * One shared list as a Flow sees it: loading, a first load's failure, or the
 * items under their own field name, with the latest refetch's failure if any.
 */
export type SharedListView<Field extends string, Item> = { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: RequestFailure }
  | ({
    readonly status: 'loaded';
    /** The latest fetch failed: the list may be out of date (OQ-193). */
    readonly refreshError?: RequestFailure | undefined;
  } & Readonly<Record<Field, readonly Item[]>>);

/** The household's categories, archived included (FR-10.3). */
export type CategoriesView = SharedListView<'categories', Category>;

/** Every shared budget and the caller's own personal ones (OQ-176). */
export type BudgetsView = SharedListView<'budgets', Budget>;

/** What the progress read adds to a goal (FR-8.5): who funds it, each with how much. */
export type GoalFunding = Pick<GoalWithProgress, 'fundedBy'>;

/** A goal as Goal Management shows it: its definition, with its funding once read. */
export interface GoalEntry {
  readonly goal: Goal;
  /** Missing while the progress read is loading or has failed (OQ-195). */
  readonly funding?: GoalFunding | undefined;
}

/**
 * One status's progress read: loading, loaded once it holds data — even if a
 * later fetch failed, which marks its list stale instead — or failed when it
 * never loaded.
 */
export type ProgressStatus = 'loading' | 'loaded' | 'failed';

/**
 * Every shared goal and the caller's personal ones (OQ-177), by status, each
 * list soonest due first, and how each status's progress read went: the
 * definitions show on their own when it fails (OQ-195).
 */
export interface GoalsView {
  readonly active: SharedListView<'goals', GoalEntry>;
  readonly completed: SharedListView<'goals', GoalEntry>;
  readonly progress: Readonly<Record<'active' | 'completed', ProgressStatus>>;
}
