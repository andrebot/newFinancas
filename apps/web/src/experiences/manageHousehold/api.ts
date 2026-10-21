import type {
  CreateInvitationResponse,
  HouseholdInvitation,
  HouseholdMembership,
  ListHouseholdInvitationsResponse,
  ListMembersResponse,
} from '@financas/api-types';
import backendApi from '../../api/backendApi';
import send from '../../api/send';
import type {
  AssignableRole, HouseholdMember, ListedInvitation,
} from './flows/membershipManagement/membershipState';

// The Manage Household Experience's endpoints (X4, OQ-160). The households
// list is a shared identity read (`api/identityApi.ts`, OQ-163); this slice
// invalidates its tag when a transfer changes the user's role. The members
// are cached per household: the page header counts them and Leave Household
// names the successor from them, so every change to the membership fetches
// them again. The invitations are the Membership Management Flow's
// own list, fetched as it mounts and never kept. A transfer also fetches the
// households again, where the user's role changed. Leaving or deleting the
// household invalidates nothing: the Experience fetches the households itself
// and moves the user on (`householdExit.ts`).

/** A member's address in the API. */
export interface MemberTarget {
  readonly householdId: string;
  readonly userId: string;
}

/** A role change. */
export interface RoleChange extends MemberTarget {
  readonly role: AssignableRole;
}

/** An invitation to send. */
export interface InvitationRequest {
  readonly householdId: string;
  readonly email: string;
  readonly role: AssignableRole;
}

/** An invitation's address in the API. */
export interface InvitationTarget {
  readonly householdId: string;
  readonly invitationId: string;
}

/**
 * Builds a household's path.
 *
 * @param householdId - The household.
 * @param rest - What follows it, e.g. `/members`.
 * @returns The path.
 */
const householdPath = (householdId: string, rest = '') => (
  `/households/${encodeURIComponent(householdId)}${rest}`
);

/**
 * Builds a member's path.
 *
 * @param target - The household and the member.
 * @returns The path.
 */
const memberPath = ({ householdId, userId }: MemberTarget) => (
  householdPath(householdId, `/members/${encodeURIComponent(userId)}`)
);

/**
 * Turns one listed invitation into the Flow's shape: the invitee's email
 * stands for who it invites.
 *
 * @param invitation - The invitation, as the API lists it.
 * @returns The Flow's invitation.
 */
export const toListedInvitation = (invitation: HouseholdInvitation): ListedInvitation => ({
  id: invitation.id,
  email: invitation.inviteeEmail,
  role: invitation.role,
  status: invitation.status,
  createdAt: invitation.createdAt,
});

/**
 * Turns one listed membership into the Flow's member.
 *
 * @param membership - The membership, as the API lists it.
 * @returns The member.
 */
export const toHouseholdMember = (membership: HouseholdMembership): HouseholdMember => ({
  userId: membership.userId,
  firstName: membership.firstName,
  lastName: membership.lastName,
  email: membership.email,
  role: membership.role,
  joinedAt: membership.joinedAt,
});

/**
 * Names the cached members of one household.
 *
 * @param householdId - The household.
 * @returns Its members' tag.
 */
const membersTag = (householdId: string) => [{ type: 'Members' as const, id: householdId }];

/** Manage Household's slice of the backend API. */
export const manageHouseholdApi = backendApi.enhanceEndpoints({
  addTagTypes: ['Households', 'Members'],
}).injectEndpoints({
  endpoints: (build) => ({
    listMembers: build.query<readonly HouseholdMember[], string>({
      query: (householdId) => householdPath(householdId, '/members'),
      transformResponse: (response: ListMembersResponse) => (
        (response.data ?? []).map(toHouseholdMember)
      ),
      providesTags: (_result, _error, householdId) => membersTag(householdId),
    }),
    listHouseholdInvitations: build.query<readonly ListedInvitation[], string>({
      query: (householdId) => householdPath(householdId, '/invitations'),
      transformResponse: (response: ListHouseholdInvitationsResponse) => (
        (response.data ?? []).map(toListedInvitation)
      ),
      keepUnusedDataFor: 0,
    }),
    changeMemberRole: build.mutation<void, RoleChange>({
      query: ({ role, ...target }) => send('PATCH', `${memberPath(target)}/role`, { role }),
      invalidatesTags: (_result, _error, { householdId }) => membersTag(householdId),
    }),
    removeMember: build.mutation<void, MemberTarget>({
      query: (target) => send('DELETE', memberPath(target)),
      invalidatesTags: (_result, _error, { householdId }) => membersTag(householdId),
    }),
    transferOwnership: build.mutation<void, MemberTarget>({
      query: ({ householdId, userId }) => send(
        'POST',
        householdPath(householdId, '/transfer-ownership'),
        { targetUserId: userId },
      ),
      invalidatesTags: (_result, _error, { householdId }) => [
        ...membersTag(householdId), 'Households',
      ],
    }),
    createInvitation: build.mutation<CreateInvitationResponse, InvitationRequest>({
      query: ({ householdId, ...invite }) => (
        send('POST', householdPath(householdId, '/invitations'), invite)
      ),
    }),
    revokeInvitation: build.mutation<void, InvitationTarget>({
      query: ({ householdId, invitationId }) => send(
        'DELETE',
        householdPath(householdId, `/invitations/${encodeURIComponent(invitationId)}`),
      ),
    }),
    // Leaving is a remove of oneself (OQ-27); the household is no longer the
    // user's, so its members aren't fetched again.
    leaveHousehold: build.mutation<void, MemberTarget>({
      query: (target) => send('DELETE', memberPath(target)),
    }),
    deleteHousehold: build.mutation<void, string>({
      query: (householdId) => send('DELETE', householdPath(householdId)),
    }),
  }),
});

export const {
  useListMembersQuery,
  useLazyListMembersQuery,
  useLazyListHouseholdInvitationsQuery,
  useChangeMemberRoleMutation,
  useRemoveMemberMutation,
  useTransferOwnershipMutation,
  useCreateInvitationMutation,
  useRevokeInvitationMutation,
  useLeaveHouseholdMutation,
  useDeleteHouseholdMutation,
} = manageHouseholdApi;
