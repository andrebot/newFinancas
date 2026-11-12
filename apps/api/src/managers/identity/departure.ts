import type { HouseholdAccessor } from '../../accessors/householdAccessor';

// A member's departure from a household (FR-1.11/FR-1.18), shared by Leave
// Household (uc-08) and Delete User (uc-12). The Manager decides — who succeeds
// the Owner, when the household dissolves; HouseholdAccessor applies each step as
// a guarded write and says `stale` when the facts changed meanwhile (OQ-107).
// erasure.ts runs each attempt in the transaction that erases the member's
// finances there (OQ-240).

/** What one attempt at departing ended in; `gone` when the membership already was. */
export type DepartureOutcome = 'left' | 'dissolved' | 'stale' | 'gone';

/** The household steps a departure takes. */
export type DepartureSteps = Pick<
  HouseholdAccessor, 'findMembership' | 'findSuccessor' | 'swapOwner' | 'removeMember' | 'dissolve'
>;

/**
 * The Owner departs: hands the household to the longest-tenured member
 * (Admin, then Member, then Viewer — FR-1.18), or dissolves it when nobody
 * else is left.
 *
 * @param households - The household steps.
 * @param householdId - The household.
 * @param ownerId - The departing Owner.
 * @returns The outcome; `stale` when someone joined, left or was promoted meanwhile.
 */
const ownerDeparts = async (
  households: DepartureSteps,
  householdId: string,
  ownerId: string,
): Promise<DepartureOutcome> => {
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
 * @param households - The household steps.
 * @param householdId - The household.
 * @param userId - The member departing.
 * @returns The outcome.
 */
const attemptDeparture = async (
  households: DepartureSteps,
  householdId: string,
  userId: string,
): Promise<DepartureOutcome> => {
  const membership = await households.findMembership(householdId, userId);
  if (!membership) return 'gone';
  if (membership.role === 'Owner') return ownerDeparts(households, householdId, userId);
  return await households.removeMember(householdId, userId) === 'removed' ? 'left' : 'stale';
};

export default attemptDeparture;
