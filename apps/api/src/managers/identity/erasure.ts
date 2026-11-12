import type { ErasureScope } from '../../accessors/erasureScope';
import { households as householdSettings } from '../../config/constants';
import inSequence from '../sequence';
import {
  loggerFor, type ErasureStores, type IdentityDeps, type SignedInContext,
} from './context';
import attemptDeparture, { type DepartureOutcome } from './departure';
import { householdChanged } from './errors';

// A user's erasure (FR-1.17/FR-1.11, OQ-240). One routine, two triggers: leaving
// or being removed from a household erases the user's finances there; Delete
// User (uc-12) erases them everywhere and then the user. Personal rows are
// deleted; shared ones stay, no longer naming the user (OQ-25). Each membership
// change commits in the same transaction (UnitOfWorkUtility) as the erasure it
// causes, so a member is never erased and kept, or gone and not erased.

/** Thrown inside a departure's transaction to roll it back when a step went stale. */
const STALE_DEPARTURE = new Error('stale departure: roll back and decide again');

/**
 * Erases a user's rows, in an order the foreign keys accept: transfers into
 * their personal Accounts are unpaired before those Accounts go.
 *
 * @param stores - The Accessors, inside the erasure's transaction.
 * @param scope - Whose rows, and in which household (every one when left out).
 * @returns Resolves once every Accessor has erased.
 */
export const forgetUser = async (stores: ErasureStores, scope: ErasureScope): Promise<void> => {
  await stores.accountTransactions.forgetUser(scope);
  await stores.cardTransactions.forgetUser(scope);
  await stores.goals.forgetUser(scope);
  await stores.budgets.forgetUser(scope);
  await stores.accounts.forgetUser(scope);
  await stores.indexRates.forgetUser(scope);
  await stores.invitations.forgetUser(scope);
};

/**
 * Builds the erasure use cases.
 *
 * @param deps - The tier below.
 * @returns `departErased`, `removeErased`, `deleteUser`.
 */
const createErasure = (deps: IdentityDeps) => {
  /**
   * One attempt at departing, in one transaction with the erasure of the
   * member's finances there: a stale step rolls both back.
   *
   * @param userId - The member departing.
   * @param householdId - The household.
   * @returns The outcome.
   */
  const attemptErased = async (userId: string, householdId: string): Promise<DepartureOutcome> => {
    try {
      return await deps.inErasure(async (stores) => {
        await forgetUser(stores, { userId, householdId });
        const outcome = await attemptDeparture(stores.households, householdId, userId);
        if (outcome === 'stale') throw STALE_DEPARTURE;
        return outcome;
      });
    } catch (error) {
      if (error === STALE_DEPARTURE) return 'stale';
      throw error;
    }
  };

  /**
   * Ends the caller's membership and erases their finances there (Leave
   * Household, and each household of Delete User), retrying from fresh facts
   * while a concurrent change makes a step `stale` (OQ-107). A membership
   * already gone — removed meanwhile — is no departure of theirs: nothing is
   * audited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param attemptsLeft - Retries remaining.
   * @throws {DomainError} `household.changed` once the retries run out — nothing
   *   of that household erased.
   */
  const departErased = async (
    context: SignedInContext,
    householdId: string,
    attemptsLeft: number = householdSettings.leaveAttempts,
  ): Promise<void> => {
    if (attemptsLeft === 0) throw householdChanged();
    const outcome = await attemptErased(context.actor.userId, householdId);
    if (outcome === 'stale') return departErased(context, householdId, attemptsLeft - 1);
    if (outcome === 'gone') return undefined;
    const action = outcome === 'dissolved' ? 'DissolveHousehold' : 'LeaveHousehold';
    loggerFor(context).audit(action, {
      entityType: 'Household', entityId: householdId, householdId,
    });
    return undefined;
  };

  return {
    departErased,

    /**
     * Removes a member and erases their finances in the household, in one
     * transaction (Remove Member, FR-1.11): a removal refused as `stale` —
     * made Owner meanwhile — rolls the erasure back.
     *
     * @param householdId - The household.
     * @param userId - The member removed.
     * @throws {DomainError} `household.changed` — nothing erased.
     */
    removeErased: (householdId: string, userId: string): Promise<void> => (
      deps.inErasure(async (stores) => {
        await forgetUser(stores, { userId, householdId });
        if (await stores.households.removeMember(householdId, userId) === 'stale') {
          throw householdChanged();
        }
      })
    ),

    /**
     * Deletes the caller's account (uc-12, FR-1.17/FR-1.18): departs every
     * household, each with its erasure — the Owner's succession, or dissolving
     * one they're alone in — then, in one transaction, erases what's left
     * everywhere (households left before included) and deletes them; their
     * sessions, MFA and notifications go with the user row. Nothing refuses
     * it. A run cut short is finished by the next.
     *
     * @param context - The signed-in request.
     * @throws {DomainError} `household.changed` when a household kept changing,
     *   or the user joined one meanwhile.
     * @throws {Error} when a row still names the user after the erasure.
     */
    deleteUser: async (context: SignedInContext): Promise<void> => {
      const { userId } = context.actor;
      const memberships = await deps.households.listForUser(userId);
      await inSequence(memberships, (household) => departErased(context, household.id));
      await deps.inErasure(async (stores) => {
        // Joined one meanwhile (another tab): deleting now would cascade the
        // membership away and could leave that household without an Owner.
        if ((await stores.households.listForUser(userId)).length > 0) throw householdChanged();
        await forgetUser(stores, { userId });
        if (await stores.users.delete(userId) === 'still_referenced') {
          throw new Error('A row still names the user after the erasure');
        }
      });
      loggerFor(context).audit('DeleteUser', {
        entityType: 'User', entityId: userId, householdId: null,
      });
    },
  };
};

export type Erasure = ReturnType<typeof createErasure>;

export default createErasure;
