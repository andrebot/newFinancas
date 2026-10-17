import type { ListHouseholdsResponse, MyHousehold, User } from '@financas/api-types';
import backendApi from './backendApi';
import type { SourceState } from '../utilities/sourceState';
import { toSourceState } from './sourceState';

// The identity reads several Experiences share (code review A2, OQ-163): the
// signed-in user (`GET /users/me`) and their households (`GET /households`).
// Manage Profile, Manage Household and — through the hooks App.tsx hands it —
// the App Shell all read them, so they belong to no one Experience's slice:
// each Experience imports them from here, never from a sibling. Only
// Experiences call these hooks; the shell gets them as sources.

/** The shared identity reads. */
export const identityApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Me', 'Households'],
}).injectEndpoints({
  endpoints: (build) => ({
    getCurrentUser: build.query<User, void>({
      query: () => '/users/me',
      providesTags: ['Me'],
    }),
    listHouseholds: build.query<readonly MyHousehold[], void>({
      query: () => '/households',
      transformResponse: (response: ListHouseholdsResponse) => response.data ?? [],
      providesTags: ['Households'],
    }),
  }),
});

export const { useGetCurrentUserQuery, useListHouseholdsQuery } = identityApi;

/**
 * The user's households, with their role in each, as the App Shell takes
 * them (`ShellSources.useHouseholds`).
 *
 * @returns The list's state.
 */
export const useHouseholds = (): SourceState<readonly MyHousehold[]> => (
  toSourceState(useListHouseholdsQuery())
);
