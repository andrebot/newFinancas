import {
  createSlice, type PayloadAction, type ThunkAction, type UnknownAction,
} from '@reduxjs/toolkit';
import backendApi from '../api/backendApi';
import type { ApiEnvironment } from '../api/baseQuery';
import { sessionEnded } from '../api/baseQuery';
import type { PreferenceStorage } from '../utilities/safeStorage';
import type { ShellHousehold } from './shellConfig';

// The App Shell's state (S1, OQ-156): whether there is a session and which
// household is active. Nothing about a journey lives here. The session starts
// when Authenticate or Onboard signs the user in (`sessionStarted`) and ends
// when the API client gives up on it, the user signs out or another tab does
// (`api/sessionEnded`). The active household is remembered in browser storage,
// so a reload returns to it; switching households resets the API cache, so
// every Experience fetches its data again for the new one (OQ-124).

/** Whether the user is signed in. */
export type SessionStatus = 'signedIn' | 'signedOut';

/** The shell's slice. */
export interface ShellState {
  readonly session: SessionStatus;
  /** The household every Experience works in; `null` until one is chosen. */
  readonly activeHouseholdId: string | null;
}

/** What the shell's thunks need from the page, next to the API client's (`{ api }`). */
export interface ShellEnvironment {
  /** The remembered active household id. */
  readonly householdMemory: PreferenceStorage;
}

/** The store's thunk extra argument: the API client's surroundings and the shell's. */
export interface ThunkExtra {
  readonly api: ApiEnvironment;
  readonly shell: ShellEnvironment;
}

/**
 * The shell's state on page load.
 *
 * @param signedIn - Whether a session survives from before (a refresh token is kept).
 * @returns The state.
 */
export const initialShellState = (signedIn: boolean): ShellState => ({
  session: signedIn ? 'signedIn' : 'signedOut',
  activeHouseholdId: null,
});

const shellSlice = createSlice({
  name: 'shell',
  initialState: initialShellState(false),
  reducers: {
    /** Authenticate or Onboard signed the user in. */
    sessionStarted: (state) => ({ ...state, session: 'signedIn' }),
    /** A household became the active one. */
    householdChosen: (state, action: PayloadAction<string>) => ({
      ...state, activeHouseholdId: action.payload,
    }),
  },
  extraReducers: (builder) => {
    builder.addCase(sessionEnded, () => initialShellState(false));
  },
});

export const { sessionStarted, householdChosen } = shellSlice.actions;

export const shellReducer = shellSlice.reducer;

/** The part of the root state the shell reads. */
export interface WithShell {
  readonly shell: ShellState;
}

/**
 * Reads whether the user is signed in.
 *
 * @param state - The root state.
 * @returns The session status.
 */
export const selectSession = (state: WithShell) => state.shell.session;

/**
 * Reads the active household's id.
 *
 * @param state - The root state.
 * @returns The id, or `null` before one is chosen.
 */
export const selectActiveHouseholdId = (state: WithShell) => state.shell.activeHouseholdId;

/** A shell thunk. */
type ShellThunk = ThunkAction<void, WithShell, ThunkExtra, UnknownAction>;

/**
 * Picks the household to work in: the preferred one while the user still
 * belongs to it, else the first they belong to.
 *
 * @param households - The user's households, in the API's order.
 * @param preferredId - The current or remembered household, if any.
 * @returns Its id, or `null` when the user has no household.
 */
export const chooseActiveHousehold = (
  households: readonly ShellHousehold[],
  preferredId: string | null,
): string | null => {
  const preferred = households.find((household) => household.id === preferredId);
  return (preferred ?? households[0])?.id ?? null;
};

/**
 * Makes sure an active household is chosen, once the user's households are
 * known: the current one, else the remembered one, else the first. Nothing
 * happens when that is already the active one.
 *
 * @param households - The user's households.
 * @returns The thunk.
 */
export const settleActiveHousehold = (households: readonly ShellHousehold[]): ShellThunk => (
  (dispatch, getState, { shell }) => {
    const current = selectActiveHouseholdId(getState());
    const chosen = chooseActiveHousehold(households, current ?? shell.householdMemory.read());
    if (chosen !== null && chosen !== current) {
      shell.householdMemory.write(chosen);
      dispatch(householdChosen(chosen));
    }
  }
);

/**
 * Switches the active household (FR-1.8) and drops every cached answer, so
 * each Experience fetches its data again for the new household (OQ-124).
 *
 * @param householdId - The household to work in.
 * @returns The thunk.
 */
export const switchHousehold = (householdId: string): ShellThunk => (
  (dispatch, getState, { shell }) => {
    if (selectActiveHouseholdId(getState()) === householdId) {
      return;
    }
    shell.householdMemory.write(householdId);
    dispatch(householdChosen(householdId));
    dispatch(backendApi.util.resetApiState());
  }
);
