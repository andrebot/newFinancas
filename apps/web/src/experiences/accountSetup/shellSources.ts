import { toSourceState } from '../../api/sourceState';
import type { SourceState } from '../../utilities/sourceState';
import { useHasAccountInUseQuery } from './api';

// What Account Setup hands the App Shell (X2G, OQ-198): whether the active
// household has an account in use. The household gate sends a household with
// none into Guided Setup — the first account is mandatory and the main
// navigation waits for it (FR-1.22, OQ-63) — so a drop-off mid-setup resumes
// there rather than on the Dashboard. A create or archive that goes through
// refreshes it.

/**
 * Whether a household has an account that isn't archived
 * (`ShellSources.useAccountInUse`).
 *
 * @param householdId - The household.
 * @returns The answer's state.
 */
const useAccountInUse = (householdId: string): SourceState<boolean> => (
  toSourceState(useHasAccountInUseQuery(householdId))
);

export default useAccountInUse;
