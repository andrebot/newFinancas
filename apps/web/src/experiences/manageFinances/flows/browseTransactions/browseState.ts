import type { RequestFailure } from '../../../../utilities/requestOutcome';
import { NO_FILTERS, type LedgerFilters } from './ledgerFilters';

// What the Browse Transactions Flow holds itself (FL16, OQ-220): the row open
// (one at a time), its delete confirm and request, and the filter drawer's
// draft. The applied filters and the pages are the Experience's — its
// infinite query is keyed by them and refetched on every write. Pure
// transitions; the controller holds the state.

/** The Flow's own state. */
export interface BrowseState {
  /** The expanded row's key. */
  readonly openRow?: string | undefined;
  /** Whether the open row's delete confirm shows. */
  readonly confirming: boolean;
  /** Whether its delete is out. */
  readonly deleting: boolean;
  /** Why the last delete failed, shown in the confirm. */
  readonly deleteFailure?: RequestFailure | undefined;
  /** The drawer's filters, applied by Show. */
  readonly draft: LedgerFilters;
  /** Whether Show was refused, so the range's errors show. */
  readonly showRangeErrors: boolean;
}

/** Nothing open, the drawer's draft empty. */
export const INITIAL_BROWSE_STATE: BrowseState = {
  confirming: false,
  deleting: false,
  draft: NO_FILTERS,
  showRangeErrors: false,
};

/**
 * Opens or closes a row: one open at a time, and a closed row's confirm goes.
 * Nothing changes while a delete is out.
 *
 * @param state - The state.
 * @param key - The row's key.
 * @param open - Whether it opens.
 * @returns The next state.
 */
export const rowToggled = (state: BrowseState, key: string, open: boolean): BrowseState => {
  if (state.deleting) return state;
  return {
    ...state, openRow: open ? key : undefined, confirming: false, deleteFailure: undefined,
  };
};

/**
 * Shows the open row's delete confirm.
 *
 * @param state - The state.
 * @returns The next state.
 */
export const deleteAsked = (state: BrowseState): BrowseState => ({
  ...state, confirming: true, deleteFailure: undefined,
});

/**
 * Hides the confirm, unless its delete is out.
 *
 * @param state - The state.
 * @returns The next state.
 */
export const deleteCancelled = (state: BrowseState): BrowseState => (
  state.deleting ? state : { ...state, confirming: false, deleteFailure: undefined }
);

/**
 * Marks the delete as out.
 *
 * @param state - The state.
 * @returns The next state.
 */
export const deleteStarted = (state: BrowseState): BrowseState => ({
  ...state, deleting: true, deleteFailure: undefined,
});

/**
 * Settles the delete: a success closes the row — the Experience's refetch
 * takes it away — and a failure stays in the confirm.
 *
 * @param state - The state.
 * @param failure - Why it failed; nothing on success.
 * @returns The next state.
 */
export const deleteEnded = (
  state: BrowseState,
  failure: RequestFailure | undefined,
): BrowseState => {
  if (failure) return { ...state, deleting: false, deleteFailure: failure };
  return {
    ...state, deleting: false, confirming: false, openRow: undefined, deleteFailure: undefined,
  };
};

/**
 * Starts the drawer's draft from the applied filters.
 *
 * @param state - The state.
 * @param filters - The applied filters.
 * @returns The next state.
 */
export const draftOpened = (state: BrowseState, filters: LedgerFilters): BrowseState => ({
  ...state, draft: filters, showRangeErrors: false,
});

/**
 * Takes the drawer's edited draft.
 *
 * @param state - The state.
 * @param draft - The new draft.
 * @returns The next state.
 */
export const draftChanged = (state: BrowseState, draft: LedgerFilters): BrowseState => ({
  ...state, draft,
});

/**
 * Marks Show as refused: the range's errors show.
 *
 * @param state - The state.
 * @returns The next state.
 */
export const applyRefused = (state: BrowseState): BrowseState => ({
  ...state, showRangeErrors: true,
});
