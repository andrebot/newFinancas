import { eq, type AnyColumn, type SQL } from 'drizzle-orm';

// What a user's erasure reaches (FR-1.17, FR-1.11, OQ-240). Leaving or being
// removed from a household erases the user's finances in that household; deleting
// the account erases them everywhere — the households they still belong to and any
// they left before. Each Accessor that holds a user's rows takes this scope in its
// `forgetUser`: personal rows go, shared rows lose the user's name.

/** Whose rows, and where. */
export interface ErasureScope {
  readonly userId: string;
  /** Only this household's rows; every household when left out. */
  readonly householdId?: string;
}

/**
 * The household condition of an erasure.
 *
 * @param column - The household column of the rows erased.
 * @param scope - The erasure.
 * @returns The condition, or `undefined` (no condition) for an erasure everywhere.
 */
export const inHousehold = (column: AnyColumn, scope: ErasureScope): SQL | undefined => (
  scope.householdId === undefined ? undefined : eq(column, scope.householdId)
);
