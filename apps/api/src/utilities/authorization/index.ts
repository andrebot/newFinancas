import type { Role } from '../../accessors/householdAccessor';
import { type AccessRequest, decide } from './permissions';

// AuthorizationUtility (U5, VBD): the yes/no gates. `hasSystemRole` checks the
// platform role on every API request; `authorize` checks the household role
// before a Manager acts — it reads only that role (HouseholdAccessor), the
// Manager passing the facts about the target it already loaded (OQ-111).

export type {
  AccessRequest, Action, DataAction, Decision, HouseholdAction, Visibility,
} from './permissions';
export { decide, PERMISSIONS } from './permissions';
export { default as hasSystemRole } from './systemRoles';

/** What the utility needs from HouseholdAccessor. */
export interface AuthorizationDeps {
  readonly findMembership: (
    householdId: string,
    userId: string,
  ) => Promise<{ readonly role: Role } | undefined>;
}

/**
 * The outcome. `not_member` and `not_visible` are answered with 404 (the
 * household or the data isn't revealed); `forbidden` with 403.
 */
export type Authorization = | { readonly outcome: 'allowed'; readonly role: Role }
  | { readonly outcome: 'not_member' | 'forbidden' | 'not_visible' };

/**
 * Creates the authorization utility.
 *
 * @param deps - The membership lookup.
 * @returns `authorize`.
 */
export const createAuthorizationUtility = (deps: AuthorizationDeps) => ({
  /**
   * Checks whether a user may do something in a household.
   *
   * @param actorId - The acting user.
   * @param householdId - The household.
   * @param request - The action and the facts about its target.
   * @returns The outcome, with the actor's role when allowed.
   */
  authorize: async (
    actorId: string,
    householdId: string,
    request: AccessRequest,
  ): Promise<Authorization> => {
    const membership = await deps.findMembership(householdId, actorId);
    if (!membership) return { outcome: 'not_member' };
    const decision = decide(membership.role, actorId, request);
    return decision === 'allowed'
      ? { outcome: 'allowed', role: membership.role }
      : { outcome: decision };
  },
});
