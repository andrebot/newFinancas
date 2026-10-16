import type {
  AcceptInvitationResponse,
  ChangePasswordData,
  EditCurrentUserData,
  ListMyInvitationsResponse,
  ListSessionsResponse,
  ReceivedInvitation,
  Session,
  User,
  UserPreferences,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';

// The Manage Profile Experience's endpoints (X3, OQ-159): the user's own
// profile and preferences, their sessions and password (Security, OQ-154),
// the account's deletion (OQ-151) and the invitations waiting for them. The
// profile and the invitations are cached; the sessions are the Security
// Flow's own list, fetched as it mounts and never kept. Answering an
// invitation fetches the invitations again — and, once accepted, the
// households (Manage Household's list), where the new one appears.

/** What a profile edit sends (`PATCH /users/me`). */
export type ProfileEdit = EditCurrentUserData['body'];

/**
 * Builds a request with a method and an optional JSON body.
 *
 * @param method - The HTTP method.
 * @param url - The path, relative to the API's base URL.
 * @param body - The JSON body, if any.
 * @returns The request's fetch arguments.
 */
const send = (method: string, url: string, body?: object) => ({ url, method, body });

/**
 * Builds the path that answers an invitation.
 *
 * @param invitationId - The invitation.
 * @param answer - `accept` or `decline`.
 * @returns The path.
 */
const invitationPath = (invitationId: string, answer: string) => (
  `/invitations/${encodeURIComponent(invitationId)}/${answer}`
);

/**
 * Lays the preferences an edit sends over the user as cached, field by field.
 *
 * @param user - The cached user.
 * @param preferences - The preferences sent.
 * @returns The user with them.
 */
export const withPreferences = (user: User, preferences: UserPreferences): User => ({
  ...user,
  preferences: { ...user.preferences, ...preferences },
});

/** Manage Profile's slice of the backend API. */
export const manageProfileApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Me', 'MyInvitations', 'Households'],
}).injectEndpoints({
  endpoints: (build) => ({
    getCurrentUser: build.query<User, void>({
      query: () => '/users/me',
      providesTags: ['Me'],
    }),
    editCurrentUser: build.mutation<User, ProfileEdit>({
      query: (edit) => send('PATCH', '/users/me', edit),
      // A preference shows at once — the shell applies the theme or language
      // as soon as the cached user changes — and is undone if the API refuses
      // it. Names wait for the answer, so a refused save keeps what is typed.
      // The answer then replaces the cached user.
      onQueryStarted: async ({ preferences }, { dispatch, queryFulfilled }) => {
        const shown = preferences && dispatch(manageProfileApi.util.updateQueryData(
          'getCurrentUser',
          undefined,
          (user) => withPreferences(user, preferences),
        ));
        try {
          const { data } = await queryFulfilled;
          dispatch(manageProfileApi.util.upsertQueryData('getCurrentUser', undefined, data));
        } catch {
          shown?.undo();
        }
      },
    }),
    deleteCurrentUser: build.mutation<void, void>({
      query: () => send('DELETE', '/users/me'),
    }),
    listSessions: build.query<readonly Session[], void>({
      query: () => '/users/me/sessions',
      transformResponse: (response: ListSessionsResponse) => response.data ?? [],
      keepUnusedDataFor: 0,
    }),
    revokeSession: build.mutation<void, string>({
      query: (sessionId) => send('DELETE', `/users/me/sessions/${encodeURIComponent(sessionId)}`),
    }),
    revokeOtherSessions: build.mutation<void, void>({
      query: () => send('DELETE', '/users/me/sessions'),
    }),
    changePassword: build.mutation<void, ChangePasswordData['body']>({
      query: (change) => send('POST', '/auth/change-password', change),
    }),
    listMyInvitations: build.query<readonly ReceivedInvitation[], void>({
      query: () => '/users/me/invitations',
      transformResponse: (response: ListMyInvitationsResponse) => response.data ?? [],
      providesTags: ['MyInvitations'],
    }),
    acceptInvitation: build.mutation<AcceptInvitationResponse, string>({
      query: (invitationId) => send('POST', invitationPath(invitationId, 'accept')),
      invalidatesTags: ['MyInvitations', 'Households'],
    }),
    declineInvitation: build.mutation<void, string>({
      query: (invitationId) => send('POST', invitationPath(invitationId, 'decline')),
      invalidatesTags: ['MyInvitations'],
    }),
  }),
});

export const {
  useGetCurrentUserQuery,
  useEditCurrentUserMutation,
  useDeleteCurrentUserMutation,
  useLazyListSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useChangePasswordMutation,
  useListMyInvitationsQuery,
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
} = manageProfileApi;
