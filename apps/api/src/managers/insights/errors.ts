import { createDomainError, type DomainError } from '../../utilities/domainError';

// The refusals InsightsManager's reads give. The not-found ones (OQ-178): a
// Holding takes its Account's access, so an unseen Account or Holding is the
// entity's own not-found — never a confirmation it exists. `household.not_found` and
// `auth.forbidden` come from the shared check in ../access.

/**
 * The Account (or the Household) does not exist for this caller.
 *
 * @returns `account.not_found`.
 */
export const accountNotFound = (): DomainError => createDomainError({
  code: 'account.not_found', message: 'Account not found',
});

/**
 * The Goal does not exist, or is someone else's personal one (OQ-111).
 *
 * @returns `goal.not_found`.
 */
export const goalNotFound = (): DomainError => createDomainError({
  code: 'goal.not_found', message: 'Goal not found',
});

/**
 * The Holding does not exist, or its Account is someone else's personal one.
 *
 * @returns `holding.not_found`.
 */
export const holdingNotFound = (): DomainError => createDomainError({
  code: 'holding.not_found', message: 'Holding not found',
});

/**
 * A v1 report type this build does not serve yet (task 133, OQ-208).
 *
 * @returns `report.unknown_type_or_range`, the code the contract reserves for it.
 */
export const reportNotServed = (): DomainError => createDomainError({
  code: 'report.unknown_type_or_range', message: 'Report type not served yet',
});
