import type { AssignableRole } from '../../db/schema/values';
import type {
  HouseholdInvitation, Invitation, Resolution,
} from '../../accessors/invitationAccessor';
import { loggerFor, type IdentityDeps, type SignedInContext } from './context';
import {
  alreadyMember, alreadyPending, invitationNotFound, invitationNotPending, inviteeNotRegistered,
} from './errors';
import { requireAccess } from './households';

// Invite User (uc-03, FR-1.5/1.19), Accept / Decline (uc-04/05) and Revoke
// (uc-06, FR-1.10). The Manager decides who may invite, answer or revoke;
// InvitationAccessor applies each change, the resolution guarded so only one of
// accept / decline / revoke can win (OQ-107, OQ-109, OQ-118).

/** Whom to invite, and as what. */
export interface InvitationRequest {
  readonly email: string;
  readonly role: AssignableRole;
}

/**
 * Builds the invitation use cases.
 *
 * @param deps - The tier below.
 * @returns `inviteUser`, `listHouseholdInvitations`, `revokeInvitation`,
 *   `acceptInvitation`, `declineInvitation`.
 */
const createInvitations = (deps: IdentityDeps) => {
  const { invitations } = deps;

  /**
   * The invitee's own pending-or-not invitation; anyone else's is "not found".
   *
   * @param context - The signed-in request.
   * @param invitationId - The invitation.
   * @returns The invitation.
   * @throws {DomainError} `invitation.not_found`.
   */
  const ownInvitation = async (
    context: SignedInContext,
    invitationId: string,
  ): Promise<Invitation> => {
    const invitation = await invitations.findById(invitationId);
    if (invitation?.invitedUserId !== context.actor.userId) throw invitationNotFound();
    return invitation;
  };

  /**
   * Resolves an invitation, refusing one that is no longer pending.
   *
   * @param invitationId - The invitation.
   * @param resolution - accepted, declined or revoked.
   * @throws {DomainError} `invitation.not_pending`.
   */
  const resolve = async (invitationId: string, resolution: Resolution): Promise<void> => {
    const resolved = await invitations.resolve(invitationId, resolution, deps.now());
    if (resolved === 'stale') throw invitationNotPending();
  };

  /**
   * Refuses an invitation to someone who is already a member or already invited.
   *
   * @param householdId - The household.
   * @param inviteeId - The person invited.
   * @throws {DomainError} `invitation.already_member` / `invitation.already_pending`.
   */
  const refuseDuplicates = async (householdId: string, inviteeId: string): Promise<void> => {
    if (await deps.households.findMembership(householdId, inviteeId)) throw alreadyMember();
    if (await invitations.findPending(householdId, inviteeId)) throw alreadyPending();
  };

  /**
   * Tells the invitee, in the app (OQ-113). Fire-and-forget: a failure is
   * logged, the invitation stands.
   *
   * @param context - The signed-in request.
   * @param invitation - The invitation sent.
   */
  const notifyInvitee = (context: SignedInContext, invitation: Invitation): void => {
    deps.notifications.notify('invitation.received', { userId: invitation.invitedUserId }, {
      invitationId: invitation.id,
      householdId: invitation.householdId,
      inviterUserId: context.actor.userId,
      role: invitation.role,
    }).catch((error: unknown) => {
      loggerFor(context).error('Invitation notification not stored', { error: String(error) });
    });
  };

  return {
    /**
     * Invites a registered user to the household — Owner/Admin only (uc-03).
     *
     * @param context - The signed-in request.
     * @param householdId - The household.
     * @param request - The invitee's email and the offered role.
     * @returns The pending invitation.
     * @throws {DomainError} `household.not_found` / `invitation.invitee_not_registered`;
     *   `auth.forbidden`; `invitation.already_member` / `already_pending`.
     */
    inviteUser: async (
      context: SignedInContext,
      householdId: string,
      request: InvitationRequest,
    ): Promise<Invitation> => {
      await requireAccess(deps, context, householdId, { action: 'members.manage' });
      const invitee = await deps.users.findByEmail(request.email.trim());
      if (!invitee) throw inviteeNotRegistered();
      await refuseDuplicates(householdId, invitee.id);
      const result = await invitations.insert({
        householdId,
        invitedUserId: invitee.id,
        invitedByUserId: context.actor.userId,
        role: request.role,
      });
      if (!result.ok) {
        throw result.reason === 'already_pending' ? alreadyPending() : inviteeNotRegistered();
      }
      notifyInvitee(context, result.invitation);
      loggerFor(context).audit('InviteUser', {
        entityType: 'Invitation', entityId: result.invitation.id, householdId,
      });
      return result.invitation;
    },

    /**
     * The household's invitations, every status, with the invitees' names —
     * Owner/Admin only (OQ-118).
     *
     * @param context - The signed-in request.
     * @param householdId - The household.
     * @returns The invitations.
     * @throws {DomainError} `household.not_found`; `auth.forbidden`.
     */
    listHouseholdInvitations: async (
      context: SignedInContext,
      householdId: string,
    ): Promise<HouseholdInvitation[]> => {
      await requireAccess(deps, context, householdId, { action: 'members.manage' });
      return invitations.listForHousehold(householdId);
    },

    /**
     * Withdraws a pending invitation before it's answered — Owner/Admin (uc-06).
     *
     * @param context - The signed-in request.
     * @param householdId - The household.
     * @param invitationId - The invitation.
     * @throws {DomainError} `household.not_found` / `invitation.not_found`; `auth.forbidden`;
     *   `invitation.not_pending`.
     */
    revokeInvitation: async (
      context: SignedInContext,
      householdId: string,
      invitationId: string,
    ): Promise<void> => {
      await requireAccess(deps, context, householdId, { action: 'members.manage' });
      const invitation = await invitations.findById(invitationId);
      if (invitation?.householdId !== householdId) throw invitationNotFound();
      await resolve(invitationId, 'revoked');
      loggerFor(context).audit('RevokeInvitation', {
        entityType: 'Invitation', entityId: invitationId, householdId,
      });
    },

    /**
     * Joins the household with the invited role (uc-04). The invitation is
     * resolved first — guarded, so a revoke racing it can't also win — then the
     * membership is added (OQ-118).
     *
     * @param context - The signed-in request.
     * @param invitationId - The caller's invitation.
     * @returns The household joined and the role.
     * @throws {DomainError} `invitation.not_found`; `invitation.not_pending`.
     */
    acceptInvitation: async (
      context: SignedInContext,
      invitationId: string,
    ): Promise<{ householdId: string; role: AssignableRole }> => {
      const invitation = await ownInvitation(context, invitationId);
      await resolve(invitationId, 'accepted');
      // `already_member` can't block anything: they are a member either way.
      const { householdId, role } = invitation;
      await deps.households.addMember(householdId, context.actor.userId, role);
      loggerFor(context).audit('AcceptInvitation', {
        entityType: 'Invitation', entityId: invitationId, householdId: invitation.householdId,
      });
      return { householdId: invitation.householdId, role: invitation.role };
    },

    /**
     * Says no to an invitation; no membership is created (uc-05). Logged, not
     * audited: FR-7.1's audit log covers household data, and declining changes
     * none — it is the invitee's own choice (uc-05's decision).
     *
     * @param context - The signed-in request.
     * @param invitationId - The caller's invitation.
     * @throws {DomainError} `invitation.not_found`; `invitation.not_pending`.
     */
    declineInvitation: async (context: SignedInContext, invitationId: string): Promise<void> => {
      const invitation = await ownInvitation(context, invitationId);
      await resolve(invitationId, 'declined');
      loggerFor(context)
        .info('Invitation declined', { invitationId, householdId: invitation.householdId });
    },
  };
};

export default createInvitations;
