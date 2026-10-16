import { useMemo } from 'react';
import { toSourceState } from '../../api/sourceState';
import type { ShellIdentity, SourceState } from '../../shell/shellConfig';
import { useGetCurrentUserQuery, useListMyInvitationsQuery } from './api';

// What Manage Profile hands the App Shell (X3, OQ-159): the signed-in user, for
// the drawer's identity and for the saved theme and language the shell applies
// (`useSavedPreferences`), and how many invitations wait for an answer, for the
// switcher's "Pending invitations". The profile page reads the same cache, so
// a saved edit shows in the chrome at once.

/**
 * The signed-in user, as the App Shell takes them (`ShellSources.useIdentity`).
 *
 * @returns The user's state; the same object while the cached user is unchanged.
 */
export const useIdentity = (): SourceState<ShellIdentity> => {
  const query = useGetCurrentUserQuery();
  const user = query.data;
  const identity = useMemo(() => user && {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    theme: user.preferences.theme,
    language: user.preferences.language,
  }, [user]);
  return toSourceState({ ...query, data: identity });
};

/**
 * How many invitations wait for the user's answer
 * (`ShellSources.usePendingInvitationCount`).
 *
 * @returns The count; 0 until the list loads.
 */
export const usePendingInvitationCount = (): number => (
  useListMyInvitationsQuery().data?.length ?? 0
);
