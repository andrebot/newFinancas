import { isFixedTerm } from '@financas/reference';
import type { Account } from '../../accessors/accountAccessor';
import type { AccountTransactionAccessor } from '../../accessors/accountTransactionAccessor';
import type { Goal, GoalAccessor, GoalAllocation } from '../../accessors/goalAccessor';
import type {
  InvestmentHoldingAccessor, PricedHolding,
} from '../../accessors/investmentHoldingAccessor';
import type { ValuationSnapshotAccessor } from '../../accessors/valuationSnapshotAccessor';

// ReportingEngine — Goal progress (FR-8.5, FR-8.7, OQ-49): each funding
// Holding's contribution on a date, in the Holding's own currency, never
// blended (FR-8.4 is the frontend's). Everything is read as of that date: the
// Goal split in effect then, and the Holding's value then — its latest
// snapshot for a market-priced one, its trades' cost basis for a fixed-term
// one (OQ-51, OQ-206). A Holding the viewer can't see still counts, unnamed
// (OQ-206), so every member sees a shared Goal's same total; each funding row
// carries its own contribution, so nothing is joined on an id it may lack.

/** What Goal progress reads. */
export interface GoalProgressDeps {
  readonly listAllocations: GoalAccessor['listAllocations'];
  readonly findHoldings: InvestmentHoldingAccessor['findByIds'];
  readonly latestSnapshots: ValuationSnapshotAccessor['latestAsOf'];
  readonly costBasisAsOf: AccountTransactionAccessor['costBasisAsOf'];
}

/** What a Holding contributes to a Goal, in the Holding's currency. */
export interface Contribution {
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
  /** Null when the Holding had no value by then. */
  readonly contribution: Contribution | null;
}

/** A Goal with its progress on a date. */
export interface GoalWithProgress {
  readonly goal: Goal;
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
 * The ids of the Accounts a viewer sees — every report decides what to name
 * from this one set.
 *
 * @param accounts - The Accounts `AccountAccessor.list` gave the viewer.
 * @returns Their ids.
 */
export const visibleAccountIdsOf = (accounts: readonly Account[]): ReadonlySet<string> => (
  new Set(accounts.map((account) => account.id))
);

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

/**
 * Shapes one allocation as the viewer is shown it: named when they see its
 * Holding, with what it contributes.
 *
 * @param allocation - The allocation.
 * @param funds - The Holdings, their values and what the viewer sees.
 * @returns The funding row, or none when the Holding wasn't found.
 */
const fundingOf = (allocation: GoalAllocation, funds: Funds): Funding[] => {
  const holding = funds.holdings.get(allocation.holdingId);
  if (!holding) return [];
  const visible = funds.visibleAccountIds.has(holding.accountId);
  const value = funds.values.get(holding.id);
  return [{
    holdingId: visible ? holding.id : null,
    name: visible ? holding.ticker : null,
    percentage: allocation.percentage,
    contribution: value === undefined
      ? null
      : { currency: holding.currency, amount: shareOf(value, allocation.percentage) },
  }];
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
  const allocations = await deps.listAllocations(
    { goalIds: goals.map((goal) => goal.id) },
    query.date,
  );
  const holdingIds = [...new Set(allocations.map((allocation) => allocation.holdingId))];
  const holdings = await deps.findHoldings(query.householdId, holdingIds);
  const funds: Funds = {
    holdings: new Map(holdings.map((holding) => [holding.id, holding])),
    values: await valuesOn(deps, holdings, query.date),
    visibleAccountIds: query.visibleAccountIds,
  };
  return goals.map((goal) => ({
    goal,
    fundedBy: allocations.filter((allocation) => allocation.goalId === goal.id)
      .flatMap((allocation) => fundingOf(allocation, funds)),
  }));
};
