import type {
  HouseholdMembership, ListHouseholdsResponse, ListMembersResponse, ListMyInvitationsResponse,
  MyHousehold, ReceivedInvitation, User,
} from '@financas/api-types';
import backendApi from './backendApi';
import type { SourceState } from '../utilities/sourceState';
import { toSourceState } from './sourceState';

// The identity reads several Experiences share (code review A2, OQ-163): the
// signed-in user (`GET /users/me`) and their households (`GET /households`).
// Manage Profile, Manage Household and — through the hooks App.tsx hands it —
// the App Shell all read them, so they belong to no one Experience's slice:
// each Experience imports them from here, never from a sibling. Only
// Experiences call these hooks; the shell gets them as sources. A household's
// members (`GET /households/:id/members`) joined them in the slice 4 review
// (A1): Manage Household lists and changes them, Track Investments names a
// rate's recorder from them; the membership writes stay Manage Household's
// and fetch them again through the `Members` tag. The invitations waiting for
// the user (`GET /users/me/invitations`) joined them with task 139 (OQ-243):
// Manage Profile answers them, and Review Insights' inbox names an
// invitation's household and inviter from them; answering stays Manage
// Profile's and fetches them again through the `MyInvitations` tag.

/** The shared identity reads. */
export const identityApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Me', 'Households', 'Members', 'MyInvitations'],
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
    // Cached per household: every change to its membership fetches it again.
    listMembers: build.query<readonly HouseholdMembership[], string>({
      query: (householdId) => `/households/${encodeURIComponent(householdId)}/members`,
      transformResponse: (response: ListMembersResponse) => response.data ?? [],
      providesTags: (_result, _error, householdId) => [{ type: 'Members', id: householdId }],
    }),
    listMyInvitations: build.query<readonly ReceivedInvitation[], void>({
      query: () => '/users/me/invitations',
      transformResponse: (response: ListMyInvitationsResponse) => response.data ?? [],
      providesTags: ['MyInvitations'],
    }),
  }),
});

export const {
  useGetCurrentUserQuery, useListHouseholdsQuery, useListMembersQuery, useLazyListMembersQuery,
  useListMyInvitationsQuery,
} = identityApi;

/**
 * The user's households, with their role in each, as the App Shell takes
 * them (`ShellSources.useHouseholds`).
 *
 * @returns The list's state.
 */
export const useHouseholds = (): SourceState<readonly MyHousehold[]> => (
  toSourceState(useListHouseholdsQuery())
);
