import type { ListHouseholdsResponse, MyHousehold } from '@financas/api-types';
import backendApi from '../../api/backendApi';
import { toSourceState } from '../../api/sourceState';
import type { ShellHousehold, SourceState } from '../../shell/shellConfig';

// The Manage Household Experience's endpoints. X3 brought the households list
// in ahead of X4 (OQ-159): the App Shell's household gate needs it to show
// any household page, and Manage Profile reads it for the user's role and the
// households they own. X4 adds the members, invitations and deletion here.

/** Manage Household's slice of the backend API. */
export const manageHouseholdApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Households'],
}).injectEndpoints({
  endpoints: (build) => ({
    listHouseholds: build.query<readonly MyHousehold[], void>({
      query: () => '/households',
      transformResponse: (response: ListHouseholdsResponse) => response.data ?? [],
      providesTags: ['Households'],
    }),
  }),
});

export const { useListHouseholdsQuery } = manageHouseholdApi;

/**
 * The user's households, with their role in each, as the App Shell takes
 * them (`ShellSources.useHouseholds`).
 *
 * @returns The list's state.
 */
export const useHouseholds = (): SourceState<readonly ShellHousehold[]> => (
  toSourceState(useListHouseholdsQuery())
);
