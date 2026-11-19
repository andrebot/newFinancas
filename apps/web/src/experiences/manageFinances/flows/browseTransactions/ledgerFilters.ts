import { TRANSACTION_KINDS, type KindGroup } from '@financas/reference';
import type { Period } from '../../../../kit/periodBar/periodBar';
import { monthEnd } from '../../../reportMonths';

// The ledger's filters (FL16, mockup 33; FR-3.12, OQ-201, OQ-204, OQ-220):
// kinds, accounts and cards (one picker — a card's rows also match its
// account), categories (each with its subcategories) and a Holding. All
// combine with AND; an empty list filters nothing. The ledger shows the month
// the period bar selects (OQ-255) — except on a Holding, whose trades show
// across every month until that filter goes.
// Pure: the drawer edits a draft of these, the Experience keeps the applied
// ones and turns them into its query through `queryOf`.

/** The ledger's filters, as the drawer edits them and the Experience keeps them. */
export interface LedgerFilters {
  readonly kinds: readonly string[];
  readonly accountIds: readonly string[];
  readonly creditCardIds: readonly string[];
  readonly categoryIds: readonly string[];
  /** Set from a Holding's "See in Transactions"; never picked in the drawer. */
  readonly holdingId?: string | undefined;
}

/** The query the Experience sends: only what filters something. */
export interface LedgerQuery {
  readonly kinds?: readonly string[];
  readonly accountIds?: readonly string[];
  readonly creditCardIds?: readonly string[];
  readonly categoryIds?: readonly string[];
  readonly holdingId?: string;
  readonly from?: string;
  readonly to?: string;
}

/** No filter: every transaction of the month. */
export const NO_FILTERS: LedgerFilters = {
  kinds: [],
  accountIds: [],
  creditCardIds: [],
  categoryIds: [],
};

/**
 * Starts the filters on one Holding — what "See in Transactions" opens with.
 *
 * @param holdingId - The Holding's id.
 * @returns The filters on that Holding alone.
 */
export const holdingFilters = (holdingId: string): LedgerFilters => ({ ...NO_FILTERS, holdingId });

/**
 * Lists a group's kind codes, in picker order.
 *
 * @param group - The kind group.
 * @returns Its kinds' codes.
 */
export const kindCodesOf = (group: KindGroup): readonly string[] => (
  TRANSACTION_KINDS.filter((kind) => kind.group === group).map((kind) => kind.code)
);

/**
 * Picks the ticked kinds that belong to a group.
 *
 * @param kinds - The ticked kinds.
 * @param group - The group.
 * @returns Those of the group.
 */
export const chosenInGroup = (kinds: readonly string[], group: KindGroup) => {
  const codes = new Set(kindCodesOf(group));
  return kinds.filter((kind) => codes.has(kind));
};

/**
 * Replaces a group's ticked kinds, keeping the other groups' and the picker's order.
 *
 * @param kinds - The ticked kinds.
 * @param group - The group.
 * @param chosen - The group's new choice.
 * @returns Every ticked kind, in picker order.
 */
export const withGroupKinds = (
  kinds: readonly string[],
  group: KindGroup,
  chosen: readonly string[],
): readonly string[] => {
  const others = new Set(kindCodesOf(group));
  const ticked = new Set([...kinds.filter((kind) => !others.has(kind)), ...chosen]);
  return TRANSACTION_KINDS.map((kind) => kind.code).filter((code) => ticked.has(code));
};

/**
 * Counts the filters in use — the Filter button's badge: kinds, accounts and
 * cards, categories and the Holding each count once.
 *
 * @param filters - The applied filters.
 * @returns How many are in use.
 */
export const activeFilterCount = (filters: LedgerFilters) => [
  filters.kinds.length > 0,
  filters.accountIds.length + filters.creditCardIds.length > 0,
  filters.categoryIds.length > 0,
  filters.holdingId !== undefined,
].filter(Boolean).length;

/**
 * Bounds a period to its first and last day.
 *
 * @param period - The month.
 * @returns `from` and `to`, `YYYY-MM-DD`.
 */
export const monthBoundsOf = (period: Period): { from: string; to: string } => {
  const month = `${period.year}-${String(period.month).padStart(2, '0')}`;
  return { from: `${month}-01`, to: monthEnd(month) };
};

/**
 * Turns the filters into the query: a list only when it has something, and
 * the selected month's days — none on a Holding, whose trades show across
 * every month (OQ-255).
 *
 * @param filters - The applied filters.
 * @param period - The month the period bar selects.
 * @returns The query.
 */
export const queryOf = (filters: LedgerFilters, period: Period): LedgerQuery => {
  const lists = {
    kinds: filters.kinds,
    accountIds: filters.accountIds,
    creditCardIds: filters.creditCardIds,
    categoryIds: filters.categoryIds,
  };
  const used = Object.entries(lists).filter(([, values]) => values.length > 0);
  return {
    ...Object.fromEntries(used),
    ...(filters.holdingId === undefined
      ? monthBoundsOf(period) : { holdingId: filters.holdingId }),
  };
};
