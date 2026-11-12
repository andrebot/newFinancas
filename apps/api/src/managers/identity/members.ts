import type { AssignableRole } from '../../db/schema/values';
import { loggerFor, type IdentityDeps, type SignedInContext } from './context';
import {
  forbidden, householdChanged, householdNotFound, memberNotFound,
} from './errors';
import createDeparture from './departure';
import createErasure from './erasure';
import { requireAccess } from './households';

// Remove Member / Leave Household (uc-07/uc-08, FR-1.11/1.18), Change Role
// (uc-09, FR-1.12) and Transfer Ownership (uc-10, FR-1.20). The Manager decides
// — who may be removed (never the Owner by someone else, OQ-111); the departure
// (departure.ts) decides who succeeds the Owner. A member who leaves or is
// removed takes their finances with them (erasure.ts, OQ-240). HouseholdAccessor
// applies each step as a guarded write and says `stale` when the facts changed
// meanwhile (OQ-107).

/**
 * Builds the member use cases.
 *
 * @param deps - The tier below.
 * @returns `removeMember`, `changeMemberRole`, `transferOwnership`.
 */
const createMembers = (deps: IdentityDeps) => {
  const { households } = deps;
  const { depart } = createDeparture(deps);
  const { eraseFromHousehold } = createErasure(deps);

  /**
   * Leaves a household — self-service, no permission needed (uc-08): the
   * caller's finances there are erased (FR-1.11, OQ-240), then the membership
   * ends, the Owner's handed on (FR-1.18).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @throws {DomainError} `household.not_found`; `household.changed`.
   */
  const leave = async (context: SignedInContext, householdId: string): Promise<void> => {
    const { userId } = context.actor;
    if (!(await households.findMembership(householdId, userId))) throw householdNotFound();
    await eraseFromHousehold(userId, householdId);
    await depart(context, householdId);
  };

  /**
   * Checks the caller may manage members and the target is a member other than
   * the Owner — nobody but the Owner ends or changes the Owner's membership
   * (FR-1.11/1.12, OQ-111).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param targetUserId - The member acted on.
   * @throws {DomainError} `household.not_found` / `household.member_not_found`;
   *   `auth.forbidden`.
   */
  const requireManageableMember = async (
    context: SignedInContext,
    householdId: string,
    targetUserId: string,
  ): Promise<void> => {
    await requireAccess(deps, context, householdId, { action: 'members.manage' });
    const target = await households.findMembership(householdId, targetUserId);
    if (!target) throw memberNotFound();
    if (target.role === 'Owner') throw forbidden();
  };

  return {
    /**
     * Removes a member (Owner/Admin, uc-07), or leaves when the target is the
     * caller (uc-08) — one endpoint, two relationships.
     *
     * @param context - The signed-in request.
     * @param householdId - The household.
     * @param targetUserId - Who leaves.
     * @throws {DomainError} a not-found / `auth.forbidden` / `household.changed`.
     */
    removeMember: async (
      context: SignedInContext,
      householdId: string,
      targetUserId: string,
    ): Promise<void> => {
      if (targetUserId === context.actor.userId) return leave(context, householdId);
      await requireManageableMember(context, householdId, targetUserId);
      await eraseFromHousehold(targetUserId, householdId);
      const removed = await households.removeMember(householdId, targetUserId);
      if (removed === 'stale') throw householdChanged();
      loggerFor(context).audit('RemoveMember', {
        entityType: 'User', entityId: targetUserId, householdId,
      });
      return undefined;
    },

    /**
     * Sets a member's role to Admin, Member or Viewer — never the Owner's, and
     * never to Owner (that's Transfer Ownership) (uc-09, FR-1.12).
     *
     * @param context - The signed-in request.
     * @param householdId - The household.
     * @param targetUserId - The member.
     * @param role - The new role.
     * @throws {DomainError} a not-found / `auth.forbidden` / `household.changed`.
     */
    changeMemberRole: async (
      context: SignedInContext,
      householdId: string,
      targetUserId: string,
      role: AssignableRole,
    ): Promise<void> => {
      await requireManageableMember(context, householdId, targetUserId);
      if (await households.updateRole(householdId, targetUserId, role) === 'stale') {
        throw householdChanged();
      }
      loggerFor(context).audit('ChangeMemberRole', {
        entityType: 'User', entityId: targetUserId, householdId,
      });
    },

    /**
     * Hands the household to another member; the Owner stays, as Admin (uc-10,
     * FR-1.20). Transferring to oneself changes nothing.
     *
     * @param context - The signed-in request.
     * @param householdId - The household.
     * @param targetUserId - The new Owner.
     * @throws {DomainError} a not-found / `auth.forbidden` (not the Owner) / `household.changed`.
     */
    transferOwnership: async (
      context: SignedInContext,
      householdId: string,
      targetUserId: string,
    ): Promise<void> => {
      await requireAccess(deps, context, householdId, { action: 'household.transferOwnership' });
      const { userId } = context.actor;
      if (targetUserId === userId) return undefined;
      if (!(await households.findMembership(householdId, targetUserId))) throw memberNotFound();
      if (await households.swapOwner(householdId, userId, targetUserId) === 'stale') {
        throw householdChanged();
      }
      loggerFor(context).audit('TransferOwnership', {
        entityType: 'User', entityId: targetUserId, householdId,
      });
      return undefined;
    },
  };
};

export default createMembers;
