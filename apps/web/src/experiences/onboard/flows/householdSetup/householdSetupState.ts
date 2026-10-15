import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// Household Setup Flow's state (FL5, OQ-150): whether the request is out and
// the last failure. One request: the name typed creates the household, and
// the Experience moves on (Guided Setup, or back to the shell) once it
// answers `ok`. The name itself lives in the Interaction, as Registration's
// fields do (OQ-148). The transitions are pure so the rules test without React.

/** The Flow's accumulated state. */
export interface HouseholdSetupState {
  /** A request is out: submits are ignored and the button spins. */
  readonly busy: boolean;
  /** The last failure, shown until the next submit. */
  readonly error?: RequestFailure | undefined;
}

/** The Flow as it opens: nothing sent, nothing failed. */
export const initialHouseholdSetup: HouseholdSetupState = { busy: false, error: undefined };

/**
 * Marks the request as out and clears the last failure.
 *
 * @param state - The current state.
 * @returns The state while the request is out.
 */
export const submitting = (state: HouseholdSetupState): HouseholdSetupState => ({
  ...state, busy: true, error: undefined,
});

/**
 * Applies the creation's outcome. Success leaves the state as it is — still
 * busy, so nothing is sent twice while the Experience moves on. A failure is
 * kept for the banner; the name typed stays in the field.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterCreate = (
  state: HouseholdSetupState,
  outcome: RequestOutcome,
): HouseholdSetupState => (
  outcome.ok ? state : { ...state, busy: false, error: outcome.error }
);
