import { isFixedTerm } from '@financas/reference';
import type { AccountTransactionAccessor } from '../../accessors/accountTransactionAccessor';
import type { Goal, GoalAccessor, GoalAllocation } from '../../accessors/goalAccessor';
import type {
  InvestmentHoldingAccessor, PricedHolding,
} from '../../accessors/investmentHoldingAccessor';
import type { ValuationSnapshotAccessor } from '../../accessors/valuationSnapshotAccessor';

// ReportingEngine — Goal progress (FR-8.5, FR-8.7, OQ-49): each funding
// Holding's contribution on a date, in the Holding's own currency, never
// blended (FR-8.4 is the frontend's). A Holding's value then is its latest
// snapshot for a market-priced one and its trades' cost basis for a fixed-term
// one (OQ-51, OQ-206). A Holding the viewer can't see still counts, unnamed
// (OQ-206), so every member sees a shared Goal's same total; its rows in
// `contributions` and `fundedBy` pair up by order, having no id to join on.

/** What Goal progress reads. */
export interface GoalProgressDeps {
  readonly listAllocations: GoalAccessor['listAllocations'];
  readonly findHoldings: InvestmentHoldingAccessor['findByIds'];
  readonly latestSnapshots: ValuationSnapshotAccessor['latestAsOf'];
  readonly costBasisAsOf: AccountTransactionAccessor['costBasisAsOf'];
}

/** One Holding's part of a Goal's money; `holdingId` null when the viewer can't see it. */
export interface Contribution {
  readonly holdingId: string | null;
  readonly currency: string;
  /** Minor units of `currency`. */
  readonly amount: number;
}

/** One Holding funding a Goal; `holdingId` and `name` null when the viewer can't see it. */
export interface Funding {
  readonly holdingId: string | null;
  /** The Holding's ticker, when it has one. */
  readonly name: string | null;
  /** Whole percent (OQ-87). */
  readonly percentage: number;
}

/** A Goal with its progress on a date. */
export interface GoalWithProgress {
  readonly goal: Goal;
  readonly contributions: readonly Contribution[];
  readonly fundedBy: readonly Funding[];
}

/** What the progress is read for: whose view, on which day. */
export interface ProgressQuery {
  readonly householdId: string;
  /** The Accounts the viewer sees — a Holding elsewhere is shown unnamed. */
  readonly visibleAccountIds: ReadonlySet<string>;
  /** `YYYY-MM-DD`: today for the current view, a month's end by month. */
  readonly date: string;
}

/**
 * A Goal's share of a Holding's value: whole percent, rounded half-up to the
 * minor unit (OQ-87).
 *
 * @param value - The Holding's value, minor units.
 * @param percentage - The Goal's whole percent.
 * @returns The contribution, minor units.
 */
export const shareOf = (value: number, percentage: number): number => (
  Math.round((value * percentage) / 100)
);

/**
 * Reads each Holding's value on a date (OQ-51, OQ-206).
 *
 * @param deps - The snapshot and cost-basis reads.
 * @param holdings - The Holdings.
 * @param date - The day.
 * @returns Values by Holding id; one with no value by then is absent.
 */
const valuesOn = async (
  deps: GoalProgressDeps,
  holdings: readonly PricedHolding[],
  date: string,
): Promise<Map<string, number>> => {
  const fixedTerm = holdings.filter((holding) => isFixedTerm(holding.assetType));
  const marketPriced = holdings.filter((holding) => !isFixedTerm(holding.assetType));
  const [snapshots, costBases] = await Promise.all([
    deps.latestSnapshots(marketPriced.map((holding) => holding.id), date),
    deps.costBasisAsOf(fixedTerm.map((holding) => holding.id), date),
  ]);
  return new Map([
    ...snapshots.map((snapshot) => [snapshot.holdingId, snapshot.valuation] as const),
    ...costBases.map((row) => [row.holdingId, row.costBasis] as const),
  ]);
};

/** What one Goal's progress is built from. */
interface Funds {
  readonly holdings: ReadonlyMap<string, PricedHolding>;
  readonly values: ReadonlyMap<string, number>;
  readonly visibleAccountIds: ReadonlySet<string>;
}

/** One allocation with its Holding, as the viewer is shown it. */
interface FundingRow {
  readonly holding: PricedHolding;
  readonly percentage: number;
  /** Null when the viewer can't see the Holding. */
  readonly holdingId: string | null;
}

/**
 * Pairs an allocation with its Holding, hiding one the viewer can't see.
 *
 * @param allocation - The allocation.
 * @param funds - The Holdings and what the viewer sees.
 * @returns The row, or none when the Holding wasn't found.
 */
const fundingRowOf = (allocation: GoalAllocation, funds: Funds): FundingRow[] => {
  const holding = funds.holdings.get(allocation.holdingId);
  if (!holding) return [];
  const visible = funds.visibleAccountIds.has(holding.accountId);
  return [{ holding, percentage: allocation.percentage, holdingId: visible ? holding.id : null }];
};

/**
 * Builds one Goal's progress from its allocations.
 *
 * @param goal - The Goal.
 * @param allocations - Its allocations, oldest first.
 * @param funds - The Holdings, their values and what the viewer sees.
 * @returns The Goal with its contributions and funding.
 */
const progressOf = (
  goal: Goal,
  allocations: readonly GoalAllocation[],
  funds: Funds,
): GoalWithProgress => {
  // A hidden Holding with no value shows nothing, so it is left out of both
  // lists: the hidden rows of each then pair up one to one, in order.
  const rows = allocations.flatMap((allocation) => fundingRowOf(allocation, funds))
    .filter((row) => row.holdingId !== null || funds.values.has(row.holding.id));
  return {
    goal,
    contributions: rows.flatMap((row) => {
      const value = funds.values.get(row.holding.id);
      return value === undefined ? [] : [{
        holdingId: row.holdingId,
        currency: row.holding.currency,
        amount: shareOf(value, row.percentage),
      }];
    }),
    fundedBy: rows.map((row) => ({
      holdingId: row.holdingId,
      name: row.holdingId === null ? null : row.holding.ticker,
      percentage: row.percentage,
    })),
  };
};

/**
 * Reads some Goals' progress on a date (FR-8.5, FR-8.7).
 *
 * @param deps - The allocation, Holding and value reads.
 * @param goals - The Goals, already narrowed to what the viewer sees.
 * @param query - The household, the viewer's Accounts and the day.
 * @returns Each Goal with its progress, in the order given.
 */
export const goalProgress = async (
  deps: GoalProgressDeps,
  goals: readonly Goal[],
  query: ProgressQuery,
): Promise<GoalWithProgress[]> => {
  const allocations = await deps.listAllocations({ goalIds: goals.map((goal) => goal.id) });
  const holdingIds = [...new Set(allocations.map((allocation) => allocation.holdingId))];
  const holdings = await deps.findHoldings(query.householdId, holdingIds);
  const funds: Funds = {
    holdings: new Map(holdings.map((holding) => [holding.id, holding])),
    values: await valuesOn(deps, holdings, query.date),
    visibleAccountIds: query.visibleAccountIds,
  };
  return goals.map((goal) => progressOf(
    goal,
    allocations.filter((allocation) => allocation.goalId === goal.id),
    funds,
  ));
};
