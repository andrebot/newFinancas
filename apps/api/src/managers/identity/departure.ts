import { households as householdSettings } from '../../config/constants';
import { loggerFor, type IdentityDeps, type SignedInContext } from './context';
import { householdChanged } from './errors';

// A member's departure from a household (FR-1.11/FR-1.18), shared by Leave
// Household (uc-08) and Delete User (uc-12). The Manager decides — who succeeds
// the Owner, when the household dissolves; HouseholdAccessor applies each step as
// a guarded write and says `stale` when the facts changed meanwhile (OQ-107).

/** What one attempt at departing ended in; `gone` when the membership already was. */
type DepartureOutcome = 'left' | 'dissolved' | 'stale' | 'gone';

/**
 * Builds the departure.
 *
 * @param deps - The tier below.
 * @returns `depart`.
 */
const createDeparture = ({ households }: Pick<IdentityDeps, 'households'>) => {
  /**
   * The Owner departs: hands the household to the longest-tenured member
   * (Admin, then Member, then Viewer — FR-1.18), or dissolves it when nobody
   * else is left.
   *
   * @param householdId - The household.
   * @param ownerId - The departing Owner.
   * @returns The outcome; `stale` when someone joined, left or was promoted meanwhile.
   */
  const ownerDeparts = async (householdId: string, ownerId: string): Promise<DepartureOutcome> => {
    const successor = await households.findSuccessor(householdId, ownerId);
    if (!successor) return households.dissolve(householdId, ownerId);
    const swapped = await households.swapOwner(householdId, ownerId, successor.userId);
    if (swapped === 'stale') return 'stale';
    // Now an Admin; if they were removed meanwhile, they have left all the same.
    await households.removeMember(householdId, ownerId);
    return 'left';
  };

  /**
   * One attempt at departing, from fresh facts.
   *
   * @param householdId - The household.
   * @param userId - The member departing.
   * @returns The outcome.
   */
  const attemptDeparture = async (
    householdId: string,
    userId: string,
  ): Promise<DepartureOutcome> => {
    const membership = await households.findMembership(householdId, userId);
    if (!membership) return 'gone';
    if (membership.role === 'Owner') return ownerDeparts(householdId, userId);
    return await households.removeMember(householdId, userId) === 'removed' ? 'left' : 'stale';
  };

  /**
   * Ends the caller's membership, retrying from fresh facts while a concurrent
   * change makes a step `stale` (OQ-107). A membership already gone — removed
   * meanwhile — is no departure of theirs: nothing is audited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param attemptsLeft - Retries remaining.
   * @throws {DomainError} `household.changed` once the retries run out.
   */
  const depart = async (
    context: SignedInContext,
    householdId: string,
    attemptsLeft: number = householdSettings.leaveAttempts,
  ): Promise<void> => {
    if (attemptsLeft === 0) throw householdChanged();
    const outcome = await attemptDeparture(householdId, context.actor.userId);
    if (outcome === 'stale') return depart(context, householdId, attemptsLeft - 1);
    if (outcome === 'gone') return undefined;
    const action = outcome === 'dissolved' ? 'DissolveHousehold' : 'LeaveHousehold';
    loggerFor(context).audit(action, {
      entityType: 'Household', entityId: householdId, householdId,
    });
    return undefined;
  };

  return { depart };
};

export default createDeparture;
