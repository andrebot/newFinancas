import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// Registration Flow's state (FL3, OQ-148): whether the request is out and the
// last failure. One request: the form's fields create the account, and the
// Onboard Experience moves on to MFA Enrollment once it answers `ok` — the
// TOTP secret and recovery codes stay with the Experience, never here. The
// transitions are pure so the Flow's rules test without React.

/** The Flow's accumulated state. */
export interface RegistrationState {
  /** A request is out: submits are ignored and the button spins. */
  readonly busy: boolean;
  /** The last failure, shown until the next submit. */
  readonly error?: RequestFailure | undefined;
}

/** The Flow as it opens: nothing sent, nothing failed. */
export const initialRegistration: RegistrationState = { busy: false, error: undefined };

/**
 * Marks the request as out and clears the last failure.
 *
 * @param state - The current state.
 * @returns The state while the request is out.
 */
export const submitting = (state: RegistrationState): RegistrationState => ({
  ...state, busy: true, error: undefined,
});

/**
 * Applies the registration's outcome. Success leaves the state as it is —
 * still busy, so nothing is sent twice while the Experience moves on. A
 * failure is kept for the form to show; what was typed stays in the form.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterRegister = (
  state: RegistrationState,
  outcome: RequestOutcome,
): RegistrationState => (
  outcome.ok ? state : { ...state, busy: false, error: outcome.error }
);
