import type { Budget, Category } from '@financas/api-types';
import type { RequestFailure } from '../../utilities/requestOutcome';

// The lists the Account Setup Experience holds and hands down to its Flows as
// display state (EBD; OQ-193, OQ-194): the household's categories — written by
// Category Management, read by Budget Management's picker — and the budgets
// the caller can see. Each is fetched again after a write before the Flow is
// answered; a list whose latest fetch failed keeps showing, with that failure
// beside it, so an open form keeps what was typed.

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
