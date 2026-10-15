import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// Account Recovery Flow's state (FL2, OQ-147): which step shows, whether a
// reset link was asked for, whether a request is out, and the last failure.
// Two requests, with the email in between: the address earns a link (the
// answer is the same whether or not an account has it), and the link's token
// plus a new password reset it. The token comes from the link's URL, read by
// the Experience, and stays here until the reset is sent. The transitions are
// pure so the Flow's rules test without React.

/** The Flow's steps: ask for a link, choose the new password, done. */
export type AccountRecoveryStep = 'request' | 'newPassword' | 'done';

/** The Flow's accumulated state. */
export interface AccountRecoveryState {
  readonly step: AccountRecoveryStep;
  /** The reset token from the emailed link; empty when there was none. */
  readonly token: string;
  /** A link was asked for: the "check your inbox" note shows. */
  readonly linkRequested: boolean;
  /** A request is out: submits are ignored and the button spins. */
  readonly busy: boolean;
  /** The last failure, shown until the next submit. */
  readonly error?: RequestFailure | undefined;
}

// The reset link can't be used again: it expired, was used, or never existed.
// The only way forward is a new link, so the Flow goes back to asking for one.
const TOKEN_INVALID = 'password_reset.token_invalid';

/**
 * The Flow as it opens: asking for a link, or — opened from the emailed
 * link — choosing the new password.
 *
 * @param token - The reset token the page was opened with, if any.
 * @returns The opening state.
 */
export const initialAccountRecovery = (token = ''): AccountRecoveryState => ({
  step: token ? 'newPassword' : 'request',
  token,
  linkRequested: false,
  busy: false,
  error: undefined,
});

/**
 * Marks a request as out and clears the last failure.
 *
 * @param state - The current state.
 * @returns The state while the request is out.
 */
export const submitting = (state: AccountRecoveryState): AccountRecoveryState => ({
  ...state, busy: true, error: undefined,
});

/**
 * Applies the link request's outcome. On success the inbox note shows and
 * stays: the user may ask again. What was typed is kept either way.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterRequest = (
  state: AccountRecoveryState,
  outcome: RequestOutcome,
): AccountRecoveryState => ({
  ...state,
  linkRequested: state.linkRequested || outcome.ok,
  busy: false,
  error: outcome.ok ? undefined : outcome.error,
});

/**
 * Applies the new password's outcome. Success shows the done step. A dead
 * link goes back to asking for a new one, with the failure in its banner;
 * any other failure stays on the step with what was typed.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterConfirm = (
  state: AccountRecoveryState,
  outcome: RequestOutcome,
): AccountRecoveryState => {
  if (outcome.ok) return { ...state, step: 'done', busy: false };

  return {
    ...state,
    step: outcome.error.code === TOKEN_INVALID ? 'request' : state.step,
    busy: false,
    error: outcome.error,
  };
};
