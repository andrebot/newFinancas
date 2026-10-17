import type { Member, UserHousehold } from '../../accessors/householdAccessor';
import type { Role } from '../../db/schema/values';
import type { AccessRequest } from '../../utilities/authorization';
import { resolveCorrelationId } from '../../utilities/correlationId';
import { nonBlank } from '../../utilities/validation';
import requireValidFields from '../validation';
import { loggerFor, type IdentityDeps, type SignedInContext } from './context';
import { forbidden, householdNotFound, unauthenticated } from './errors';

// Create, view and delete a household, and list its members (uc-01, uc-02,
// FR-1.4/1.7). Every action checks the caller's household role first (OQ-111).

/**
 * Checks the caller may act in the household, answering like the API does: a
 * non-member gets 404 (the household isn't revealed), a member without the
 * role 403.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param request - The action.
 * @returns The caller's role.
 * @throws {ApiError} 404 `household.not_found`; 403 `auth.forbidden`.
 */
export const requireAccess = async (
  deps: IdentityDeps,
  context: SignedInContext,
  householdId: string,
  request: AccessRequest,
): Promise<Role> => {
  const result = await deps.authorization.authorize(context.actor.userId, householdId, request);
  if (result.outcome === 'allowed') return result.role;
  throw result.outcome === 'not_member' ? householdNotFound() : forbidden();
};

/**
 * Builds the household use cases.
 *
 * @param deps - The tier below.
 * @returns `createHousehold`, `getHousehold`, `deleteHousehold`, `listMembers`.
 */
const createHouseholds = (deps: IdentityDeps) => ({
  /**
   * Creates a household with the caller as its Owner (uc-01, FR-1.4), and
   * announces it so AccountManager seeds the default categories in the
   * creator's language — through the bus, never a direct call (VBD §3.1b).
   *
   * @param context - The signed-in request.
   * @param name - The household's name; trimmed here, and must not be blank.
   * @returns The household, with the caller's role.
   * @throws {ApiError} 422 `validation.failed` for a blank name; 401
   *   `auth.unauthenticated` when the account is gone.
   */
  createHousehold: async (context: SignedInContext, name: string): Promise<UserHousehold> => {
    requireValidFields({ name }, { name: nonBlank });
    const { userId } = context.actor;
    const creator = await deps.users.findById(userId);
    if (!creator) throw unauthenticated();
    const household = await deps.households.insert(name.trim(), userId);
    deps.bus.publish(
      'household.created',
      { householdId: household.id, createdByUserId: userId, language: creator.language },
      resolveCorrelationId(context.correlationId),
    );
    loggerFor(context).audit('CreateHousehold', {
      entityType: 'Household', entityId: household.id, householdId: household.id,
    });
    return { ...household, role: 'Owner' };
  },

  /**
   * One of the caller's households (FR-1.8).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @returns The household, with the caller's role.
   * @throws {ApiError} 404 `household.not_found` when missing or not theirs.
   */
  getHousehold: async (context: SignedInContext, householdId: string): Promise<UserHousehold> => {
    const mine = await deps.households.listForUser(context.actor.userId);
    const household = mine.find((candidate) => candidate.id === householdId);
    if (!household) throw householdNotFound();
    return household;
  },

  /**
   * Dissolves a household on purpose — Owner only; everything household-scoped
   * goes with it (uc-02, FR-1.7).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @throws {ApiError} 404 `household.not_found`; 403 `auth.forbidden`.
   */
  deleteHousehold: async (context: SignedInContext, householdId: string): Promise<void> => {
    await requireAccess(deps, context, householdId, { action: 'household.delete' });
    if (!(await deps.households.delete(householdId))) throw householdNotFound();
    loggerFor(context).audit('DeleteHousehold', {
      entityType: 'Household', entityId: householdId, householdId,
    });
  },

  /**
   * The household's members, longest-tenured first (any member may look).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @returns The members, with names and roles.
   * @throws {ApiError} 404 `household.not_found`.
   */
  listMembers: async (context: SignedInContext, householdId: string): Promise<Member[]> => {
    await requireAccess(deps, context, householdId, { action: 'household.view' });
    return deps.households.listMembers(householdId);
  },
});

export default createHouseholds;
