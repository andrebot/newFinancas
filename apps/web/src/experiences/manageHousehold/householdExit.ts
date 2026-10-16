import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import backendApi from '../../api/backendApi';
import { switchHousehold, type ThunkExtra } from '../../shell/shellState';
import type { RootState } from '../../store';
import { manageHouseholdApi } from './api';

// After the user left or deleted the active household (X4, OQ-160): the
// households are fetched again and the App Shell switches to the next one —
// which resets the API cache, so nothing of the old household stays cached —
// and the user lands on its Dashboard. With none left, Onboard. When the list
// can't be fetched, the cache is reset anyway, so the shell's gate fetches it
// again and offers its retry.

/** Where the user goes once the household is gone. */
export type ExitDestination = 'dashboard' | 'onboard';

/** The exit thunk. */
type ExitThunk = ThunkAction<Promise<ExitDestination>, RootState, ThunkExtra, UnknownAction>;

/**
 * Moves the user on from a household they no longer belong to.
 *
 * @param goneId - The household left or deleted.
 * @returns The thunk; it resolves where the user goes.
 */
export const moveOnFrom = (goneId: string): ExitThunk => async (dispatch) => {
  const request = dispatch(
    manageHouseholdApi.endpoints.listHouseholds.initiate(undefined, { forceRefetch: true }),
  );
  const result = await request;
  request.unsubscribe();
  const next = result.data?.find((household) => household.id !== goneId);
  if (next) {
    dispatch(switchHousehold(next.id));
    return 'dashboard';
  }
  if (result.isSuccess) return 'onboard';
  dispatch(backendApi.util.resetApiState());
  return 'dashboard';
};
