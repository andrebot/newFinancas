import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { sessionEnded } from '../../api/baseQuery';
import type { ThunkExtra, WithShell } from '../../shell/shellState';
import { authenticateApi } from './api';

// Authenticate's Sign Out (X1, OQ-157): the standalone Interaction the App
// Shell's drawer hosts, handed to it as `ShellActions.signOut`. It ends this
// session on the server (FR-1.9: this device only), then in this browser.
// The order matters: ending the session first would forget the access token
// the logout call needs. A logout that fails (no answer, server error) still
// signs the user out here — they asked to leave; the API client has logged
// it, and the server session lapses or is revoked from Security.

/** The Sign Out thunk. */
type SignOutThunk = ThunkAction<Promise<void>, WithShell, ThunkExtra, UnknownAction>;

/**
 * Signs the user out of this session.
 *
 * @returns The thunk; it resolves once the session has ended in this browser.
 */
const signOut = (): SignOutThunk => async (dispatch) => {
  const logout = dispatch(authenticateApi.endpoints.logout.initiate());
  await logout;
  logout.reset();
  dispatch(sessionEnded());
};

export default signOut;
