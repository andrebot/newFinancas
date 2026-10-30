import { TRANSACTION_KINDS, type KindGroup } from '@financas/reference';
import type { DateRangeValue } from '../../../../kit/dateRangePicker/dateRangePresets';
import { dateRangeEnd, isoDate, type FieldError } from '../../../../utilities/validation';

// The ledger's filters (FL16, mockup 33; FR-3.12, OQ-201, OQ-204, OQ-220):
// kinds, accounts and cards (one picker — a card's rows also match its
// account), categories (each with its subcategories), a Holding and a date
// range of any span. All combine with AND; an empty list filters nothing.
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
  readonly range: DateRangeValue;
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

/** A date range's refusals, by end. */
export interface RangeProblems {
  readonly from?: FieldError;
  readonly to?: FieldError;
}

/** No filter: every transaction, any time. */
export const NO_FILTERS: LedgerFilters = {
  kinds: [],
  accountIds: [],
  creditCardIds: [],
  categoryIds: [],
  range: { preset: 'anyTime', from: '', to: '' },
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
 * cards, categories, the date range and the Holding each count once.
 *
 * @param filters - The applied filters.
 * @returns How many are in use.
 */
export const activeFilterCount = (filters: LedgerFilters) => [
  filters.kinds.length > 0,
  filters.accountIds.length + filters.creditCardIds.length > 0,
  filters.categoryIds.length > 0,
  filters.range.from !== '' || filters.range.to !== '',
  filters.holdingId !== undefined,
].filter(Boolean).length;

/**
 * Turns the filters into the query: a list only when it has something, a date
 * only when it is set.
 *
 * @param filters - The applied filters.
 * @returns The query.
 */
export const queryOf = (filters: LedgerFilters): LedgerQuery => {
  const lists = {
    kinds: filters.kinds,
    accountIds: filters.accountIds,
    creditCardIds: filters.creditCardIds,
    categoryIds: filters.categoryIds,
  };
  const used = Object.entries(lists).filter(([, values]) => values.length > 0);
  return {
    ...Object.fromEntries(used),
    ...(filters.holdingId === undefined ? {} : { holdingId: filters.holdingId }),
    ...(filters.range.from === '' ? {} : { from: filters.range.from }),
    ...(filters.range.to === '' ? {} : { to: filters.range.to }),
  };
};

/**
 * Checks the date range: each end a real date, To not before From.
 *
 * @param range - The drawer's range.
 * @returns Each end's refusal; empty when the range is fine.
 */
export const rangeProblemsOf = (range: DateRangeValue): RangeProblems => {
  const from = isoDate()(range.from);
  const to = dateRangeEnd(range.from)(range.to);
  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
};

/**
 * Tells whether a range has no refusal.
 *
 * @param problems - The range's refusals.
 * @returns `true` when both ends are fine.
 */
export const isRangeClear = (problems: RangeProblems) => (
  problems.from === undefined && problems.to === undefined
);
