import { mfa } from '../../../../config/constants';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// MFA Enrollment Flow's state (FL4, OQ-149): which step shows, the method
// chosen, whether the confirmation is out, and its last failure. Mandatory,
// no skip (FR-1.15): pick the method, scan and confirm with a live code, then
// acknowledge the backup codes. The secret, QR URI and codes come from the
// Experience as props; the code typed and the "saved" tick live in their
// Interactions. The transitions are pure so the Flow's rules test without React.

/** A second factor offered at enrollment (configuration: `mfa.methods`). */
export type MfaMethod = (typeof mfa.methods)[number];

/** The Flow's steps, in order. */
export type MfaEnrollmentStep = 'method' | 'setup' | 'codes';

/** The Flow's accumulated state. */
export interface MfaEnrollmentState {
  readonly step: MfaEnrollmentStep;
  readonly method: MfaMethod;
  /** The confirmation is out: the button spins and the code isn't sent again. */
  readonly busy: boolean;
  /** The last failure, shown in the banner until the next submit or step. */
  readonly error?: RequestFailure | undefined;
  /** Bumped to remount the setup step after a failure, clearing the code. */
  readonly attempt: number;
}

/** The Flow as it opens: the method step, the first method selected. */
export const INITIAL_MFA_ENROLLMENT: MfaEnrollmentState = {
  step: 'method', method: mfa.methods[0], busy: false, error: undefined, attempt: 0,
};

/**
 * Moves on to the setup step with the method chosen.
 *
 * @param state - The current state.
 * @param method - The method chosen.
 * @returns The setup step.
 */
export const methodChosen = (state: MfaEnrollmentState, method: MfaMethod): MfaEnrollmentState => ({
  ...state, step: 'setup', method,
});

/**
 * Goes back to the method step, the choice kept, no banner.
 *
 * @param state - The current state.
 * @returns The method step.
 */
export const backToMethod = (state: MfaEnrollmentState): MfaEnrollmentState => ({
  ...state, step: 'method', error: undefined,
});

/**
 * Marks the confirmation as out and clears the last failure.
 *
 * @param state - The current state.
 * @returns The state while the request is out.
 */
export const submitting = (state: MfaEnrollmentState): MfaEnrollmentState => ({
  ...state, busy: true, error: undefined,
});

/**
 * Applies the confirmation's outcome: on success the backup codes show; on
 * failure the setup step remounts for another code, with the reason.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterConfirm = (
  state: MfaEnrollmentState,
  outcome: RequestOutcome,
): MfaEnrollmentState => (
  outcome.ok
    ? { ...state, step: 'codes', busy: false }
    : {
      ...state, busy: false, error: outcome.error, attempt: state.attempt + 1,
    }
);
