import type {
  Account, Currency, HoldingAllocation, IndexRateSeries, InvestmentHolding,
  InvestmentsOverviewReport, ValuationSnapshot,
} from '@financas/api-types';
import { findKind, isFixedTerm } from '@financas/reference';
import type { AllocationGoal, AllocationRow } from '../../../../kit/allocationEditor/allocation';
import type { HistoryEntry } from '../../../../kit/historyEditor/historyModel';

// What the Holding Maintenance Flow (FL19; mockups 51, 52; FR-5.1, FR-5.2,
// FR-5.9, FR-8.2, OQ-234) reads from the overview and a Holding's details:
// the investment accounts with their totals, an account's Holdings in their
// two groups with today's values (the overview's `holding` slices — a
// fixed-term Holding the report leaves out is worth its cost basis), the type
// bar, a fixed-term contract's term, a position's average price and yield,
// the value history as K46 takes it, and the split as K47 takes it. Pure, so
// it tests without React.

/** One allocation slice, as the report sends it. */
type AllocationSlice = InvestmentsOverviewReport['allocations'][number];

/** One of this month's payouts, as the report sends it. */
type PayoutEntry = InvestmentsOverviewReport['payoutThisMonth'][number];

/** The two groups the table draws (mockup 51). */
export type HoldingGroupKind = 'fixedIncome' | 'variableIncome';

/** An investment account on the picker. */
export interface AccountCard {
  readonly account: Account;
  /** Today's value of its active Holdings, in its currency. */
  readonly value: number;
  /** How many of its Holdings are still open. */
  readonly openHoldings: number;
}

/** One Holding's row. */
export interface HoldingRow {
  readonly holding: InvestmentHolding;
  /** Today's value, in the account's currency. */
  readonly value: number;
  readonly archived: boolean;
}

/** One of the table's groups. */
export interface HoldingGroup {
  readonly kind: HoldingGroupKind;
  /** The active rows' value. */
  readonly total: number;
  /** The active rows, largest first, then the archived ones by ticker. */
  readonly rows: readonly HoldingRow[];
}

/** One asset type's share of the account (the type bar). */
export interface TypeShare {
  readonly assetType: string;
  readonly amount: number;
  /** Whole percent of the account's value, rounded. */
  readonly percent: number;
}

/** How far a fixed-term contract has run. */
export interface ContractTerm {
  /** Whole percent of the days from the buy to the due date gone by, 0–100. */
  readonly elapsedPercent: number;
  /** Whole years and months still to go; both 0 once due. */
  readonly yearsLeft: number;
  readonly monthsLeft: number;
  /** Days still to go; 0 once due. Read when less than a whole month is left. */
  readonly daysLeft: number;
  /** Whether the due date has come (review round 1: an unredeemed contract stays listed). */
  readonly matured: boolean;
}

/** A Goal the split can name: active ones can take a share, completed ones are only kept. */
export interface HoldingGoal extends AllocationGoal {
  /** A completed Goal's share is kept or removed, never grown (FR-8.9). */
  readonly completed: boolean;
}

/** A new market value against the current one. */
export interface ValueChange {
  /** Minor units, signed. */
  readonly amount: number;
  /** The relative change; null when there's nothing to compare against (no value, or zero). */
  readonly ratio: number | null;
}

/** The units a Quantity counts in: 1e-8 of a unit (OQ-86). */
const QUANTITY_SCALE = 100_000_000;

/** A day, in milliseconds: the term's days to go. */
const DAY_MS = 86_400_000;

/**
 * Tells whether a Holding is a fixed-term contract (FR-11.1, OQ-79).
 *
 * @param holding - The Holding.
 * @returns Whether its asset type is fixed-term; one with none isn't.
 */
export const isFixedTermHolding = (holding: InvestmentHolding) => (
  isFixedTerm(holding.assetType ?? '')
);

/**
 * Reads a slice's amount in one currency.
 *
 * @param slices - The report's slices.
 * @param kind - The slice kind.
 * @param key - The Holding's or Account's id.
 * @param currency - The currency.
 * @returns The amount, or nothing when the report left it out (worth nothing, or not active).
 */
const sliceAmountOf = (
  slices: readonly AllocationSlice[],
  kind: AllocationSlice['kind'],
  key: string,
  currency: Currency,
) => slices.find((slice) => (
  slice.kind === kind && slice.key === key && slice.currency === currency
))?.amount;

/**
 * Tells today's value of a Holding: the report's slice; one it leaves out is
 * worth its cost basis when fixed-term (FR-5.4, so an archived but unredeemed
 * contract still shows), and nothing otherwise.
 *
 * @param holding - The Holding.
 * @param slices - The report's slices.
 * @param currency - Its account's currency.
 * @returns The value, in minor units.
 */
export const holdingValueOf = (
  holding: InvestmentHolding,
  slices: readonly AllocationSlice[],
  currency: Currency,
): number => {
  const sliced = sliceAmountOf(slices, 'holding', holding.id ?? '', currency);
  if (sliced !== undefined) return sliced;
  return isFixedTermHolding(holding) ? holding.costBasis ?? 0 : 0;
};

/**
 * Builds the account picker's cards: every account holding at least one
 * Holding, archived ones included, in the accounts' order.
 *
 * @param accounts - The accounts the user can see.
 * @param holdings - The household's Holdings.
 * @param slices - The report's slices, for each account's value.
 * @returns The cards.
 */
export const accountCardsOf = (
  accounts: readonly Account[],
  holdings: readonly InvestmentHolding[],
  slices: readonly AllocationSlice[],
): AccountCard[] => accounts.flatMap((account) => {
  const own = holdings.filter((holding) => holding.accountId === account.id);
  if (own.length === 0) return [];
  return [{
    account,
    value: sliceAmountOf(slices, 'account', account.id, account.currency) ?? 0,
    openHoldings: own.filter((holding) => !holding.archivedAt).length,
  }];
});

/**
 * Reads a row's ticker.
 *
 * @param row - The row.
 * @returns Its Holding's ticker; an empty one when missing.
 */
const tickerOf = (row: HoldingRow) => row.holding.ticker ?? '';

/**
 * Orders a group's rows: the active ones largest first, then the archived
 * ones by ticker.
 *
 * @param first - One row.
 * @param second - The other.
 * @returns The sort order.
 */
const byPlace = (first: HoldingRow, second: HoldingRow) => {
  if (first.archived !== second.archived) return Number(first.archived) - Number(second.archived);
  if (!first.archived && second.value !== first.value) return second.value - first.value;
  return tickerOf(first).localeCompare(tickerOf(second));
};

/**
 * Builds the table's groups for one account: Fixed income (every fixed-term
 * type) then Variable income, each only when it has a row.
 *
 * @param holdings - The account's Holdings, archived ones included.
 * @param slices - The report's slices.
 * @param currency - The account's currency.
 * @returns The groups.
 */
export const holdingGroupsOf = (
  holdings: readonly InvestmentHolding[],
  slices: readonly AllocationSlice[],
  currency: Currency,
): HoldingGroup[] => {
  const rows = holdings.map((holding) => ({
    holding,
    value: holdingValueOf(holding, slices, currency),
    archived: Boolean(holding.archivedAt),
  }));
  const kinds: readonly HoldingGroupKind[] = ['fixedIncome', 'variableIncome'];
  return kinds.flatMap((kind) => {
    const own = rows
      .filter((row) => isFixedTermHolding(row.holding) === (kind === 'fixedIncome'))
      .sort(byPlace);
    if (own.length === 0) return [];
    const total = own.reduce((sum, row) => sum + (row.archived ? 0 : row.value), 0);
    return [{ kind, total, rows: own }];
  });
};

/**
 * Adds up the groups' active value.
 *
 * @param groups - The table's groups.
 * @returns The account's value.
 */
export const groupsTotalOf = (groups: readonly HoldingGroup[]) => (
  groups.reduce((sum, group) => sum + group.total, 0)
);

/**
 * Shares the account's value out by asset type, largest first (the type bar);
 * a type worth nothing is left out.
 *
 * @param groups - The table's groups.
 * @returns The shares; none when the account is worth nothing.
 */
export const typeSharesOf = (groups: readonly HoldingGroup[]): TypeShare[] => {
  const total = groupsTotalOf(groups);
  if (total <= 0) return [];
  const byType = new Map<string, number>();
  groups.flatMap((group) => group.rows)
    .filter((row) => !row.archived && row.value > 0)
    .forEach((row) => {
      const type = row.holding.assetType ?? 'other';
      byType.set(type, (byType.get(type) ?? 0) + row.value);
    });
  return [...byType]
    .sort(([, first], [, second]) => second - first)
    .map(([assetType, amount]) => ({
      assetType, amount, percent: Math.round((amount / total) * 100),
    }));
};

/**
 * Reads a day as a UTC instant.
 *
 * @param isoDate - `YYYY-MM-DD`.
 * @returns Its midnight, UTC, in milliseconds.
 */
const dayOf = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

/**
 * Counts the whole months from one day to a later one.
 *
 * @param from - The earlier day.
 * @param to - The later day.
 * @returns The whole months between them; 0 when `to` isn't later.
 */
const wholeMonthsBetween = (from: string, to: string) => {
  const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12
    + Number(to.slice(5, 7)) - Number(from.slice(5, 7));
  const short = Number(to.slice(8, 10)) < Number(from.slice(8, 10)) ? 1 : 0;
  return Math.max(0, months - short);
};

/**
 * Tells how far a fixed-term contract has run and how long it has to go.
 *
 * @param boughtOn - The buy's day.
 * @param dueDate - The contract's due date.
 * @param today - Today.
 * @returns The term; fully elapsed on or after the due date.
 */
export const contractTermOf = (boughtOn: string, dueDate: string, today: string): ContractTerm => {
  const span = dayOf(dueDate) - dayOf(boughtOn);
  const gone = dayOf(today) - dayOf(boughtOn);
  const ratio = span > 0 ? gone / span : 1;
  const left = wholeMonthsBetween(today, dueDate);
  const daysLeft = Math.max(0, Math.round((dayOf(dueDate) - dayOf(today)) / DAY_MS));
  return {
    elapsedPercent: Math.round(Math.min(1, Math.max(0, ratio)) * 100),
    yearsLeft: Math.floor(left / 12),
    monthsLeft: left % 12,
    daysLeft,
    matured: daysLeft === 0,
  };
};

/**
 * Tells a position's average price: what it cost per unit.
 *
 * @param holding - The Holding.
 * @returns Minor units per unit, rounded; null with no units.
 */
export const averagePriceOf = (holding: InvestmentHolding): number | null => {
  const quantity = holding.quantity ?? 0;
  if (quantity <= 0) return null;
  return Math.round(((holding.costBasis ?? 0) * QUANTITY_SCALE) / quantity);
};

/**
 * Reads a quantity in units.
 *
 * @param quantity - 1e-8 units, as the contract sends it.
 * @returns The units.
 */
export const unitsOf = (quantity: number | undefined) => (quantity ?? 0) / QUANTITY_SCALE;

/**
 * Adds up a Holding's payouts this month (FR-5.9).
 *
 * @param entries - The report's payouts this month.
 * @param holdingId - The Holding.
 * @param currency - Its account's currency.
 * @returns The total, in minor units.
 */
export const payoutThisMonthOf = (
  entries: readonly PayoutEntry[],
  holdingId: string,
  currency: Currency,
) => entries
  .filter((entry) => entry.holdingId === holdingId && entry.currency === currency)
  .reduce((sum, entry) => sum + entry.amount, 0);

/**
 * Tells this month's yield: the payout against today's value.
 *
 * @param payout - This month's payout.
 * @param value - Today's value.
 * @returns The ratio; null with no payout or no value.
 */
export const monthlyYieldOf = (payout: number, value: number): number | null => (
  payout > 0 && value > 0 ? payout / value : null
);

/**
 * Turns the snapshots into K46's entries, newest first as the API sends them
 * (OQ-232): a trade's snapshot is locked with the caller's reason (OQ-56).
 *
 * @param snapshots - The Holding's snapshots, newest first.
 * @param tradeReason - Why a trade's snapshot can't be changed, translated.
 * @returns The entries.
 */
export const historyEntriesOf = (
  snapshots: readonly ValuationSnapshot[],
  tradeReason: string,
): HistoryEntry[] => snapshots.map((snapshot) => ({
  key: snapshot.id ?? '',
  date: snapshot.asOfDate ?? '',
  value: snapshot.valuation ?? 0,
  lockedReason: snapshot.source === 'transaction' ? tradeReason : undefined,
}));

/**
 * Compares a new market value with the current one.
 *
 * @param current - The current value, if any.
 * @param next - The value about to be saved.
 * @returns The change.
 */
export const valueChangeOf = (current: number | undefined, next: number): ValueChange => {
  const base = current ?? 0;
  return { amount: next - base, ratio: base > 0 ? (next - base) / base : null };
};

/**
 * Builds K47's rows from a Holding's split: each visible Goal's share, named
 * and with its progress; a share whose Goal isn't listed is the server's to
 * keep (OQ-178, OQ-218).
 *
 * @param shares - The split read.
 * @param goals - The Goals the user can see, completed ones included.
 * @returns The rows, in the split's order.
 */
export const allocationRowsOf = (
  shares: readonly HoldingAllocation[],
  goals: readonly HoldingGoal[],
): AllocationRow[] => shares.flatMap((share) => {
  const goal = goals.find((candidate) => candidate.id === share.goalId);
  return goal ? [{
    goalId: goal.id,
    name: goal.name,
    percent: share.percentage,
    progress: goal.progress,
    completed: goal.completed,
  }] : [];
});

/**
 * Turns K47's rows into the request's split; call it only on a valid split.
 *
 * @param rows - The rows.
 * @returns The allocations.
 */
export const allocationsOf = (rows: readonly AllocationRow[]): HoldingAllocation[] => (
  rows.map((row) => ({ goalId: row.goalId, percentage: row.percent ?? 0 }))
);

/**
 * Tells whether the split differs from the saved one, so Save and Reset wake.
 *
 * @param rows - The rows being edited.
 * @param saved - The rows as read.
 * @returns Whether anything changed.
 */
export const isSplitChanged = (rows: readonly AllocationRow[], saved: readonly AllocationRow[]) => (
  rows.length !== saved.length || rows.some((row, index) => (
    row.goalId !== saved[index]?.goalId || row.percent !== saved[index]?.percent
  ))
);

/**
 * Reads an index's latest value (the estimate note's "if Selic stays at …").
 *
 * @param series - Every index with its values, newest first.
 * @param index - The index the rate tracks.
 * @returns Its latest value and unit, or nothing when none is recorded.
 */
export const latestIndexOf = (series: readonly IndexRateSeries[], index: string) => {
  const found = series.find((candidate) => candidate.index === index);
  const latest = found?.values[0];
  return found && latest ? { value: latest.value, unit: found.unit } : undefined;
};

/**
 * Signs an activity row's amount by its kind's direction (stored amounts are positive, OQ-98).
 *
 * @param kind - The transaction's kind.
 * @param amount - Its amount.
 * @returns The amount, negative for money out.
 */
export const signedActivityAmountOf = (kind: string | undefined, amount: number | undefined) => {
  const value = amount ?? 0;
  // `0 - value`, not `-value`: no −0 for an empty amount.
  return findKind(kind ?? '')?.direction === 'out' ? 0 - value : value;
};
