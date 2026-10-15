import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// Sign In Flow's state (FL1, OQ-145): which step shows, the email to keep
// when the Flow starts over, whether a request is out, and the last failure.
// Sign-in takes two requests: the password earns a challenge (held by the
// Experience, never here), then the MFA or backup code trades it for a
// session. The transitions are pure so the Flow's rules test without React.

/** The Flow's steps: the password, then one of the two second factors. */
export type SignInStep = 'credentials' | 'code' | 'backupCode';

/** The Flow's accumulated state. */
export interface SignInState {
  readonly step: SignInStep;
  /** The address last submitted, put back when the password step shows again. */
  readonly email: string;
  /** A request is out: submits are ignored and the button spins. */
  readonly busy: boolean;
  /** The last failure, shown in the banner until the next submit or switch. */
  readonly error?: RequestFailure | undefined;
  /** Bumped to remount the step's entry, clearing what was typed. */
  readonly attempt: number;
}

/** The Flow as it opens: the password step, nothing typed. */
export const INITIAL_SIGN_IN: SignInState = {
  step: 'credentials', email: '', busy: false, error: undefined, attempt: 0,
};

// Failures the challenge can't survive: it expired, or the address is now
// locked for longer than the challenge lives. The Flow starts over.
const RESTART_CODES: ReadonlySet<string> = new Set([
  'auth.challenge_expired', 'auth.too_many_attempts',
]);

/**
 * Marks a request as out and clears the last failure.
 *
 * @param state - The current state.
 * @returns The state while the request is out.
 */
export const submitting = (state: SignInState): SignInState => ({
  ...state, busy: true, error: undefined,
});

/**
 * Applies the password step's outcome: on success the code step shows; on
 * failure the step remounts (the password is cleared, the email kept).
 *
 * @param state - The state while the request was out.
 * @param email - The address submitted.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterCredentials = (
  state: SignInState,
  email: string,
  outcome: RequestOutcome,
): SignInState => ({
  ...state,
  step: outcome.ok ? 'code' : 'credentials',
  email,
  busy: false,
  error: outcome.ok ? undefined : outcome.error,
  attempt: state.attempt + 1,
});

/**
 * Applies a second factor's outcome. Success leaves the Flow busy: the
 * Experience takes over. A wrong code clears the entry for another try
 * without retyping the password (OQ-145); an expired challenge or a locked
 * address goes back to the password step, email kept.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterSecondFactor = (state: SignInState, outcome: RequestOutcome): SignInState => {
  if (outcome.ok) return state;

  return {
    ...state,
    step: RESTART_CODES.has(outcome.error.code) ? 'credentials' : state.step,
    busy: false,
    error: outcome.error,
    attempt: state.attempt + 1,
  };
};

/**
 * Shows another step — the user asked for it (back, backup code, the app) —
 * with nothing typed and no banner.
 *
 * @param state - The current state.
 * @param step - The step to show.
 * @returns The next state.
 */
export const switchedTo = (state: SignInState, step: SignInStep): SignInState => ({
  ...state, step, error: undefined, attempt: state.attempt + 1,
});
