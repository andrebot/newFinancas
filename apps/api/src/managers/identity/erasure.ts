import type { ErasureScope } from '../../accessors/erasureScope';
import inSequence from '../sequence';
import {
  loggerFor, type ErasureStores, type IdentityDeps, type SignedInContext,
} from './context';
import createDeparture from './departure';

// A user's erasure (FR-1.17/FR-1.11, OQ-240). One routine, two triggers: leaving
// or being removed from a household erases the user's finances there; Delete
// User (uc-12) erases them everywhere and then the user. Personal rows are
// deleted; shared ones stay, no longer naming the user (OQ-25). Each erasure is
// one transaction (UnitOfWorkUtility), so it happens whole or not at all.

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
 * @returns `eraseFromHousehold`, `deleteUser`.
 */
const createErasure = (deps: IdentityDeps) => {
  const { depart } = createDeparture(deps);

  return {
    /**
     * Erases a member's finances in one household, before the membership ends
     * (Leave Household, Remove Member — FR-1.11). Erasing first means a
     * departure that fails is simply retried; the erasure is whole either way.
     *
     * @param userId - The member.
     * @param householdId - The household.
     * @returns Resolves once erased.
     */
    eraseFromHousehold: (userId: string, householdId: string): Promise<void> => (
      deps.inErasure((stores) => forgetUser(stores, { userId, householdId }))
    ),

    /**
     * Deletes the caller's account (uc-12, FR-1.17/FR-1.18): departs every
     * household — the Owner's succession, or dissolving one they're alone in —
     * then, in one transaction, erases their finances everywhere (households
     * they left before included) and deletes them; their sessions, MFA and
     * notifications go with the user row. Nothing refuses it. A run cut short
     * is finished by the next.
     *
     * @param context - The signed-in request.
     * @throws {DomainError} `household.changed` when a household kept changing.
     * @throws {Error} when a row still names the user after the erasure.
     */
    deleteUser: async (context: SignedInContext): Promise<void> => {
      const { userId } = context.actor;
      const memberships = await deps.households.listForUser(userId);
      await inSequence(memberships, (household) => depart(context, household.id));
      await deps.inErasure(async (stores) => {
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

export default createErasure;
