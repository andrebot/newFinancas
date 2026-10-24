import type { Role, Visibility } from '../db/schema/values';
import { createDomainError, type DomainError } from '../utilities/domainError';
import type { AccessRequest, AuthorizationUtility, DataAction } from '../utilities/authorization';

// The household access check every Manager takes before it acts (OQ-111), and
// the answers it gives: a non-member never learns the household exists, someone
// else's personal data is the entity's own not-found, a missing role is
// `auth.forbidden`.

/**
 * The household doesn't exist or the caller isn't a member — the same answer
 * for both, so it never confirms a household exists (OQ-117).
 *
 * @returns `household.not_found`.
 */
export const householdNotFound = (): DomainError => createDomainError({
  code: 'household.not_found', message: 'Household not found',
});

/**
 * A member without the household role an action needs (FR-1.7, OQ-111).
 *
 * @returns `auth.forbidden`.
 */
export const forbidden = (): DomainError => createDomainError({
  code: 'auth.forbidden', message: 'Not permitted in this household',
});

/**
 * Checks the caller may act in the household, answering like the API does: a
 * non-member gets `household.not_found`, someone else's personal data the
 * entity's own not-found (`notVisible`), a member without the role `auth.forbidden`.
 *
 * @param authorization - AuthorizationUtility.
 * @param actorId - The acting user.
 * @param householdId - The household.
 * @param request - The action and the facts about its target.
 * @param notVisible - The not-found for data the actor may not see (default: the household's).
 * @returns The caller's role.
 * @throws {DomainError} `household.not_found` or `notVisible()`; `auth.forbidden`.
 */
export const requireAccess = async (
  authorization: Pick<AuthorizationUtility, 'authorize'>,
  actorId: string,
  householdId: string,
  request: AccessRequest,
  notVisible: () => DomainError = householdNotFound,
): Promise<Role> => {
  const result = await authorization.authorize(actorId, householdId, request);
  if (result.outcome === 'allowed') return result.role;
  if (result.outcome === 'not_member') throw householdNotFound();
  throw result.outcome === 'not_visible' ? notVisible() : forbidden();
};

/** What an access decision reads off personal-or-shared data (FR-2.3/4.2). */
export interface Owned {
  readonly visibility: Visibility;
  readonly ownerUserId: string | null;
}

/**
 * The access request that is only the membership check: what a household's
 * lists ask, since every member may read them (each list then holds only
 * what its reader may see), and what data that isn't there falls back to.
 */
export const memberOnly: AccessRequest = {
  action: 'data.view', visibility: 'shared', ownerUserId: null,
};

/**
 * The access request for an action on personal-or-shared data; for data that
 * isn't there, only the membership check, so a non-member still learns nothing.
 *
 * @param owned - The Account, Budget, …, if found.
 * @param action - The data action.
 * @returns What AuthorizationUtility decides on.
 */
export const accessToOwned = (owned: Owned | undefined, action: DataAction): AccessRequest => (
  owned
    ? { action, visibility: owned.visibility, ownerUserId: owned.ownerUserId }
    : memberOnly
);
