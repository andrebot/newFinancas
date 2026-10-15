import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// Household Deletion Flow's state (FL10, OQ-146): whether the user is still
// reading what deleting costs or typing the household's name, what they typed,
// whether the request is out, and the last failure. The transitions are pure
// so the Flow's rules test without React.

/** The Flow's steps: the consequences, then the type-to-confirm. */
export type HouseholdDeletionStep = 'review' | 'confirm';

/** The Flow's accumulated state. */
export interface HouseholdDeletionState {
  readonly step: HouseholdDeletionStep;
  /** What the user typed in the type-to-confirm ("confirmation text", BDT). */
  readonly confirmation: string;
  /** The request is out: the confirm spins and the rest is disabled. */
  readonly busy: boolean;
  /** The last failure, shown under the confirm until the next try or a cancel. */
  readonly error?: RequestFailure | undefined;
  /** The review is back after a cancel: its button takes the focus again. */
  readonly returning: boolean;
}

/** The Flow as it opens: the consequences, nothing typed. */
export const INITIAL_HOUSEHOLD_DELETION: HouseholdDeletionState = {
  step: 'review', confirmation: '', busy: false, error: undefined, returning: false,
};

/**
 * Opens the type-to-confirm: the user read the consequences and went on.
 *
 * @param state - The current state.
 * @returns The state with the confirm open and nothing typed.
 */
export const continued = (state: HouseholdDeletionState): HouseholdDeletionState => ({
  ...state, step: 'confirm', confirmation: '', error: undefined, returning: false,
});

/**
 * Keeps what the user typed.
 *
 * @param state - The current state.
 * @param confirmation - The field's new text.
 * @returns The state with the text kept.
 */
export const typed = (
  state: HouseholdDeletionState,
  confirmation: string,
): HouseholdDeletionState => ({ ...state, confirmation });

/**
 * Closes the type-to-confirm and goes back to the consequences, forgetting
 * what was typed and the last failure.
 *
 * @param state - The current state.
 * @returns The review again, its button to take the focus.
 */
export const cancelled = (state: HouseholdDeletionState): HouseholdDeletionState => ({
  ...state, step: 'review', confirmation: '', error: undefined, returning: true,
});

/**
 * Marks the request as out and clears the last failure.
 *
 * @param state - The current state.
 * @returns The state while the request is out.
 */
export const submitting = (state: HouseholdDeletionState): HouseholdDeletionState => ({
  ...state, busy: true, error: undefined,
});

/**
 * Applies the Experience's answer. Success leaves the Flow busy: the household
 * is gone and the Experience takes the user elsewhere. A failure stops the
 * spinner and shows why, the typed name kept for another try.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterDelete = (
  state: HouseholdDeletionState,
  outcome: RequestOutcome,
): HouseholdDeletionState => (
  outcome.ok ? state : { ...state, busy: false, error: outcome.error }
);
