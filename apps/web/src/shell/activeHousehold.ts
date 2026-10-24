import type { ShellHousehold } from './shellConfig';
import { selectActiveHouseholdId } from './shellState';
import { useAppSelector } from '../store';
import type { SourceState } from '../utilities/sourceState';
import { useGetCurrentUserQuery, useHouseholds } from '../api/identityApi';
import { toSourceState } from '../api/sourceState';

// The household page's starting point (X4, X5): the signed-in user and the
// household they're working in, read together from the shared identity reads
// (OQ-163). Every household page is behind the App Shell's household gate,
// which already answers a households list that fails or holds no active one;
// what's left here is the user's own fetch failing, with its retry.

/** The signed-in user's id and the active household, once both are known. */
export interface ActiveHousehold {
  readonly userId: string;
  readonly household: ShellHousehold;
}

/**
 * Reads the signed-in user and the active household as one source.
 *
 * @returns Ready with both, failed with a retry when the user can't be
 *   fetched, or loading until both are known.
 */
export const useActiveHousehold = (): SourceState<ActiveHousehold> => {
  const user = toSourceState(useGetCurrentUserQuery());
  const households = useHouseholds();
  const activeId = useAppSelector(selectActiveHouseholdId);
  const household = households.status === 'ready'
    ? households.data.find(({ id }) => id === activeId)
    : undefined;

  if (user.status === 'ready' && household) {
    return { status: 'ready', data: { userId: user.data.id, household } };
  }
  if (user.status === 'failed') return user;
  return { status: 'loading' };
};
