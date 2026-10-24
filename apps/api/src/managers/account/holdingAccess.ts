import type { InvestmentHolding } from '../../accessors/investmentHoldingAccessor';
import type { Role } from '../../db/schema/values';
import type { DataAction } from '../../utilities/authorization';
import { accessToOwned, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import type { AccountDeps } from './context';
import { holdingArchived, holdingNotFound } from './errors';

// Who may act on a Holding (OQ-178): a Holding has no owner of its own, so it
// takes its Account's — personal, the owner's alone; shared, the permission
// table plus the Member who created the Account (OQ-111).

/** The household and the Holding a request names. */
export interface HoldingIds {
  readonly householdId: string;
  readonly holdingId: string;
}

/** A Holding the caller may act on, and the caller's household role. */
export interface LoadedHolding {
  readonly holding: InvestmentHolding;
  readonly role: Role;
}

/**
 * Loads a Holding the caller may take an action on, deciding on its Account.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param ids - The household and the Holding.
 * @param action - The data action.
 * @returns The Holding and the caller's role.
 * @throws {DomainError} `household.not_found` / `holding.not_found`; `auth.forbidden`.
 */
export const loadHolding = async (
  deps: AccountDeps,
  context: SignedInContext,
  ids: HoldingIds,
  action: DataAction,
): Promise<LoadedHolding> => {
  const holding = await deps.holdings.findById(ids.householdId, ids.holdingId);
  const account = holding && await deps.accounts.findById(ids.householdId, holding.accountId);
  const role = await requireAccess(
    deps.authorization,
    context.actor.userId,
    ids.householdId,
    accessToOwned(account, action),
    holdingNotFound,
  );
  if (!holding || !account) throw holdingNotFound();
  return { holding, role };
};

/**
 * Refuses a change to an archived Holding (FR-5.8, OQ-178).
 *
 * @param holding - The Holding.
 * @throws {DomainError} `holding.archived`.
 */
export const requireOpenHolding = (holding: InvestmentHolding): void => {
  if (holding.archivedAt !== null) throw holdingArchived();
};
