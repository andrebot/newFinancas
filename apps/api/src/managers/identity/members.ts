import type { AssignableRole } from '../../db/schema/values';
import { households as householdSettings } from '../../config/constants';
import { loggerFor, type IdentityDeps, type SignedInContext } from './context';
import {
  forbidden, householdChanged, householdNotFound, memberNotFound,
} from './errors';
import { requireAccess } from './households';

// Remove Member / Leave Household (uc-07/uc-08, FR-1.11/1.18), Change Role
// (uc-09, FR-1.12) and Transfer Ownership (uc-10, FR-1.20). The Manager decides
// — who may be removed (never the Owner by someone else, OQ-111), who succeeds
// the Owner, when the household dissolves; HouseholdAccessor applies each step
// as a guarded write and says `stale` when the facts changed meanwhile (OQ-107).

/** What one attempt at leaving ended in. */
type LeaveOutcome = 'left' | 'dissolved' | 'stale';

/**
 * Builds the member use cases.
 *
 * @param deps - The tier below.
 * @returns `removeMember`, `changeMemberRole`, `transferOwnership`.
 */
const createMembers = (deps: IdentityDeps) => {
  const { households } = deps;

  /**
   * The Owner leaves: hands the household to the longest-tenured member
   * (Admin, then Member, then Viewer — FR-1.18), or dissolves it when nobody
   * else is left.
   *
   * @param householdId - The household.
   * @param ownerId - The leaving Owner.
   * @returns The outcome; `stale` when someone joined, left or was promoted meanwhile.
   */
  const ownerLeaves = async (householdId: string, ownerId: string): Promise<LeaveOutcome> => {
    const successor = await households.findSuccessor(householdId, ownerId);
    if (!successor) return households.dissolve(householdId, ownerId);
    const swapped = await households.swapOwner(householdId, ownerId, successor.userId);
    if (swapped === 'stale') return 'stale';
    // Now an Admin; if they were removed meanwhile, they have left all the same.
    await households.removeMember(householdId, ownerId);
    return 'left';
  };

  /**
   * One attempt at leaving, from fresh facts.
   *
   * @param householdId - The household.
   * @param userId - The member leaving.
   * @returns The outcome.
   * @throws {ApiError} 404 `household.not_found` when not a member.
   */
  const attemptLeave = async (householdId: string, userId: string): Promise<LeaveOutcome> => {
    const membership = await households.findMembership(householdId, userId);
    if (!membership) throw householdNotFound();
    if (membership.role === 'Owner') return ownerLeaves(householdId, userId);
    return await households.removeMember(householdId, userId) === 'removed' ? 'left' : 'stale';
  };

  /**
   * Leaves a household — self-service, no permission needed (uc-08). Retries
   * from fresh facts while a concurrent change makes a step `stale` (OQ-107).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param attemptsLeft - Retries remaining.
   * @throws {ApiError} 404 `household.not_found`; 409 `household.changed`.
   */
  const leave = async (
    context: SignedInContext,
    householdId: string,
    attemptsLeft: number = householdSettings.leaveAttempts,
  ): Promise<void> => {
    if (attemptsLeft === 0) throw householdChanged();
    const outcome = await attemptLeave(householdId, context.actor.userId);
    if (outcome === 'stale') return leave(context, householdId, attemptsLeft - 1);
    const action = outcome === 'dissolved' ? 'DissolveHousehold' : 'LeaveHousehold';
    loggerFor(context).audit(action, {
      entityType: 'Household', entityId: householdId, householdId,
    });
    return undefined;
  };

  /**
   * Checks the caller may manage members and the target is a member other than
   * the Owner — nobody but the Owner ends or changes the Owner's membership
   * (FR-1.11/1.12, OQ-111).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param targetUserId - The member acted on.
   * @throws {ApiError} 404 `household.not_found` / `household.member_not_found`;
   *   403 `auth.forbidden`.
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
     * @throws {ApiError} 404 / 403 / 409 `household.changed`.
     */
    removeMember: async (
      context: SignedInContext,
      householdId: string,
      targetUserId: string,
    ): Promise<void> => {
      if (targetUserId === context.actor.userId) return leave(context, householdId);
      await requireManageableMember(context, householdId, targetUserId);
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
     * @throws {ApiError} 404 / 403 / 409 `household.changed`.
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
     * @throws {ApiError} 404 / 403 (not the Owner) / 409 `household.changed`.
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
