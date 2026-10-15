import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';

// Security Flow's state (FL7, OQ-154): the user's sessions as the Flow last
// fetched them, the revoke that is out (one session or all the others), the
// open "sign out all others" confirm, the password change that is out, and the
// last failure of each panel. The transitions are pure so the Flow's rules
// test without React.

/** One of the user's sessions, as `GET /users/me/sessions` lists it. */
export interface SecuritySession {
  readonly id: string;
  /** The User-Agent the device signed in with; `null` when it sent none. */
  readonly deviceInfo: string | null;
  /** When the device signed in (ISO 8601). */
  readonly createdAt: string;
  /** When the device last refreshed its access (ISO 8601). */
  readonly lastUsedAt: string;
  /** The session making the request: the device the user is on. */
  readonly current: boolean;
}

/** What the Experience answers for the sessions: the list, or why it failed. */
export type SessionsOutcome = { readonly ok: true; readonly sessions: readonly SecuritySession[] }
  | { readonly ok: false; readonly error: RequestFailure };

/** The sessions panel's content: loading, failed with a retry, or the list. */
export type SessionsView = { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: RequestFailure }
  | { readonly status: 'loaded'; readonly sessions: readonly SecuritySession[] };

/** What a revoke ends: one session, or every one but the current. */
export type RevokeTarget = { readonly scope: 'one'; readonly sessionId: string }
  | { readonly scope: 'others' };

/** The Flow's accumulated state. */
export interface SecurityState {
  readonly sessions: SessionsView;
  /** The revoke that is out, if any: its button spins and the others wait. */
  readonly revoking?: RevokeTarget | undefined;
  /** The last revoke's failure, shown in the sessions panel. */
  readonly revokeError?: RequestFailure | undefined;
  /** The "sign out all others" confirm is open. */
  readonly confirmingOthers: boolean;
  /** The password change is out: its button spins. */
  readonly passwordBusy: boolean;
  /** The last password change's failure. */
  readonly passwordError?: RequestFailure | undefined;
  /** Goes up after each change, so the password form starts empty again. */
  readonly passwordForm: number;
}

/** The Flow as it opens: the sessions loading, nothing out. */
export const INITIAL_SECURITY: SecurityState = {
  sessions: { status: 'loading' },
  revoking: undefined,
  revokeError: undefined,
  confirmingOthers: false,
  passwordBusy: false,
  passwordError: undefined,
  passwordForm: 0,
};

/**
 * Orders the sessions: the current one first, then the most recently used.
 *
 * @param sessions - The sessions as the API listed them.
 * @returns A sorted copy.
 */
export const sortSessions = (
  sessions: readonly SecuritySession[],
): readonly SecuritySession[] => [...sessions].sort((left, right) => (
  Number(right.current) - Number(left.current)
  || right.lastUsedAt.localeCompare(left.lastUsedAt)
));

/**
 * Keeps the sessions that pass a test, when the list is loaded.
 *
 * @param view - The sessions panel's content.
 * @param keep - Whether a session stays.
 * @returns The content with the others dropped; unchanged when not loaded.
 */
const keepSessions = (
  view: SessionsView,
  keep: (session: SecuritySession) => boolean,
): SessionsView => (
  view.status === 'loaded' ? { ...view, sessions: view.sessions.filter(keep) } : view
);

/**
 * Tells whether a session outlives a revoke.
 *
 * @param target - What the revoke ended.
 * @returns The test.
 */
const survives = (target: RevokeTarget) => (session: SecuritySession) => (
  target.scope === 'one' ? session.id !== target.sessionId : session.current
);

/**
 * Marks the sessions as loading again (a retry) and drops the last revoke
 * failure.
 *
 * @param state - The current state.
 * @returns The state while the list is fetched.
 */
export const loadingSessions = (state: SecurityState): SecurityState => ({
  ...state, sessions: { status: 'loading' }, revokeError: undefined,
});

/**
 * Applies the Experience's answer for the sessions.
 *
 * @param state - The state while the list was fetched.
 * @param outcome - The list, or why it failed.
 * @returns The state with the list sorted, or the failure and its retry.
 */
export const afterLoad = (state: SecurityState, outcome: SessionsOutcome): SecurityState => ({
  ...state,
  sessions: outcome.ok
    ? { status: 'loaded', sessions: sortSessions(outcome.sessions) }
    : { status: 'failed', error: outcome.error },
});

/**
 * Opens the "sign out all others" confirm.
 *
 * @param state - The current state.
 * @returns The state with the confirm open and no failure.
 */
export const othersConfirmOpened = (state: SecurityState): SecurityState => ({
  ...state, confirmingOthers: true, revokeError: undefined,
});

/**
 * Closes the "sign out all others" confirm, forgetting its failure.
 *
 * @param state - The current state.
 * @returns The state with the confirm closed.
 */
export const othersConfirmCancelled = (state: SecurityState): SecurityState => ({
  ...state, confirmingOthers: false, revokeError: undefined,
});

/**
 * Marks a revoke as out and drops the last failure.
 *
 * @param state - The current state.
 * @param target - What the revoke ends.
 * @returns The state while the revoke is out.
 */
export const revokeStarted = (state: SecurityState, target: RevokeTarget): SecurityState => ({
  ...state, revoking: target, revokeError: undefined,
});

/**
 * Applies the Experience's answer for the revoke that was out. Success drops
 * what it ended from the list and closes the confirm; a failure keeps both
 * and shows why.
 *
 * @param state - The state while the revoke was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterRevoke = (state: SecurityState, outcome: RequestOutcome): SecurityState => {
  const { revoking } = state;
  if (!outcome.ok) return { ...state, revoking: undefined, revokeError: outcome.error };
  return {
    ...state,
    sessions: revoking ? keepSessions(state.sessions, survives(revoking)) : state.sessions,
    revoking: undefined,
    confirmingOthers: false,
  };
};

/**
 * Marks the password change as out and drops its last failure.
 *
 * @param state - The current state.
 * @returns The state while the change is out.
 */
export const passwordSubmitting = (state: SecurityState): SecurityState => ({
  ...state, passwordBusy: true, passwordError: undefined,
});

/**
 * Applies the Experience's answer for the password change. Success empties
 * the form and drops every other session from the list — the API signed them
 * out (FR-1.14); a failure keeps what was typed and shows why.
 *
 * @param state - The state while the change was out.
 * @param outcome - The Experience's answer.
 * @returns The next state.
 */
export const afterPasswordChange = (
  state: SecurityState,
  outcome: RequestOutcome,
): SecurityState => (
  outcome.ok
    ? {
      ...state,
      sessions: keepSessions(state.sessions, survives({ scope: 'others' })),
      passwordBusy: false,
      passwordForm: state.passwordForm + 1,
      confirmingOthers: false,
    }
    : { ...state, passwordBusy: false, passwordError: outcome.error }
);
