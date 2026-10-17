import {
  and, asc, eq, inArray, isNotNull, isNull, or, sql,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { goalAllocations, goals, investmentHoldings } from '../db/schema';
import type { Visibility } from '../db/schema/values';

// GoalAccessor (A13, VBD): Goals and the Goal Allocations that fund them from
// Investment Holdings (FR-8, 02-data-model.md). It applies data changes only.
// Which Goals a member may fund, and that a completed Goal can't gain funding
// (FR-8.9), are AccountManager's decisions (OQ-168); a buy's re-weighted split
// is TransactionManager's. What stays here, for both Managers:
// - a Goal of another household is never touched or allocated to;
// - a Holding's allocations never sum past 100% (FR-8.3), a cross-row rule no
//   CHECK can express, written while holding the Holding's row lock so two
//   allocation writes on one Holding run one after the other.
// Completing is the one reversible lifecycle flag (FR-8.8/8.9); deleting is hard,
// its allocations cascade away and the Holdings stay (FR-8.6).

export interface Goal {
  readonly id: string;
  readonly householdId: string;
  /** Owner if personal; provenance (nullable) if shared. */
  readonly ownerUserId: string | null;
  readonly name: string;
  /** Minor units of `targetCurrency`. */
  readonly targetAmount: number;
  readonly targetCurrency: string;
  /** `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly visibility: Visibility;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

/** A Goal to create; its creator owns it (identity if personal, provenance if shared). */
export interface NewGoal {
  readonly householdId: string;
  readonly ownerUserId: string;
  readonly name: string;
  readonly targetAmount: number;
  readonly targetCurrency: string;
  readonly dueDate: string;
  readonly visibility: Visibility;
}

/** What an edit may change (FR-8.1): never the scope, never the allocations (OQ-48). */
export interface GoalChanges {
  readonly name?: string;
  readonly targetAmount?: number;
  readonly targetCurrency?: string;
  readonly dueDate?: string;
}

/** Which Goals a list returns: still open, or completed (FR-8.8). */
export type GoalStatus = 'active' | 'completed';

/** One Goal's share of one Holding, in whole percent (OQ-87). */
export interface AllocationShare {
  readonly goalId: string;
  readonly percentage: number;
}

export interface GoalAllocation extends AllocationShare {
  readonly id: string;
  readonly holdingId: string;
  readonly createdAt: Date;
}

/** Whose allocations to list: one Holding's, or those funding some Goals. */
export type AllocationFilter = | { readonly holdingId: string }
  | { readonly goalIds: readonly string[] };

export type ReplaceAllocationsResult = | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'holding_not_found' }
  /** Not a Goal of this household. */
  | { readonly ok: false; readonly reason: 'goal_not_found'; readonly goalId: string }
  /** FR-8.3: `current` is the Holding's total before, `requested` the refused one. */
  | {
    readonly ok: false;
    readonly reason: 'allocation_exceeds_100';
    readonly current: number;
    readonly requested: number;
  };

const MAX_TOTAL_PERCENTAGE = 100;

const goalColumns = {
  id: goals.id,
  householdId: goals.householdId,
  ownerUserId: goals.ownerUserId,
  name: goals.name,
  targetAmount: goals.targetAmount,
  targetCurrency: goals.targetCurrency,
  dueDate: goals.dueDate,
  visibility: goals.visibility,
  completedAt: goals.completedAt,
  createdAt: goals.createdAt,
};

const allocationColumns = {
  id: goalAllocations.id,
  holdingId: goalAllocations.holdingId,
  goalId: goalAllocations.goalId,
  percentage: goalAllocations.percentage,
  createdAt: goalAllocations.createdAt,
};

type GoalRow = Omit<Goal, 'visibility'> & { readonly visibility: string };

/**
 * Narrows a row's `visibility` to the closed set the CHECK constraint enforces.
 *
 * @param row - A selected Goal row.
 * @returns The Goal.
 */
const toGoal = (row: GoalRow): Goal => ({ ...row, visibility: row.visibility as Visibility });

/**
 * The condition selecting one Goal of a household.
 *
 * @param householdId - The household.
 * @param goalId - The Goal.
 * @returns The SQL condition.
 */
const goalIs = (householdId: string, goalId: string) => and(
  eq(goals.id, goalId),
  eq(goals.householdId, householdId),
);

/**
 * The condition selecting the Goals a member can see in a household, in one
 * status: every shared one and their own personal ones (FR-8.1).
 *
 * @param householdId - The household.
 * @param viewerUserId - The member.
 * @param status - Active or completed.
 * @returns The SQL condition.
 */
const visibleTo = (householdId: string, viewerUserId: string, status: GoalStatus) => and(
  eq(goals.householdId, householdId),
  or(
    eq(goals.visibility, 'shared'),
    and(eq(goals.visibility, 'personal'), eq(goals.ownerUserId, viewerUserId)),
  ),
  status === 'active' ? isNull(goals.completedAt) : isNotNull(goals.completedAt),
);

/**
 * Adds up allocation percentages.
 *
 * @param shares - The allocations.
 * @returns Their total, in whole percent.
 */
const totalOf = (shares: readonly { readonly percentage: number }[]) => shares
  .reduce((total, share) => total + share.percentage, 0);

/**
 * Finds the first Goal of a list that isn't one of this household's. Locks the
 * found ones (`FOR KEY SHARE`) so none can be deleted before its allocation is
 * written; completing or editing them is not blocked.
 *
 * @param db - A transaction.
 * @param householdId - The Holding's household.
 * @param goalIds - The Goals to fund.
 * @returns The missing Goal's id, or `undefined` when all are found.
 */
const findForeignGoal = async (db: Database, householdId: string, goalIds: readonly string[]) => {
  if (goalIds.length === 0) return undefined;
  const found = await db.select({ id: goals.id }).from(goals)
    .where(and(eq(goals.householdId, householdId), inArray(goals.id, [...goalIds])))
    .for('key share');
  const foundIds = new Set(found.map((row) => row.id));
  return goalIds.find((goalId) => !foundIds.has(goalId));
};

/**
 * Builds the GoalAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createGoalAccessor = (db: Database) => ({
  /**
   * Creates a Goal, open and unfunded (FR-8.1, OQ-48).
   *
   * @param goal - The Goal.
   * @returns The created Goal.
   */
  insert: async (goal: NewGoal): Promise<Goal> => {
    const [row] = await db.insert(goals).values(goal).returning(goalColumns);
    return toGoal(row!);
  },

  /**
   * Reads one Goal of a household.
   *
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @returns The Goal, or `undefined`.
   */
  findById: async (householdId: string, goalId: string): Promise<Goal | undefined> => {
    const [row] = await db.select(goalColumns).from(goals).where(goalIs(householdId, goalId));
    return row && toGoal(row);
  },

  /**
   * Reads the Goals of a household among some ids — those an allocation write
   * names, for the Manager's visibility and completed checks.
   *
   * @param householdId - The household.
   * @param goalIds - The Goals.
   * @returns The ones found, in no particular order.
   */
  findByIds: async (householdId: string, goalIds: readonly string[]): Promise<Goal[]> => {
    if (goalIds.length === 0) return [];
    const rows = await db.select(goalColumns).from(goals)
      .where(and(eq(goals.householdId, householdId), inArray(goals.id, [...goalIds])));
    return rows.map(toGoal);
  },

  /**
   * Lists the Goals a member can see (shared ones and their own personal ones)
   * in one status, soonest due first.
   *
   * @param householdId - The household.
   * @param viewerUserId - The member.
   * @param status - Active or completed.
   * @returns The Goals.
   */
  list: async (householdId: string, viewerUserId: string, status: GoalStatus): Promise<Goal[]> => {
    const rows = await db.select(goalColumns).from(goals)
      .where(visibleTo(householdId, viewerUserId, status))
      .orderBy(asc(goals.dueDate), asc(goals.name), asc(goals.id));
    return rows.map(toGoal);
  },

  /**
   * Edits a Goal's name, target and/or due date (FR-8.1). Changing the target
   * currency is allowed: progress is derived on read, nothing stored follows it.
   *
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @param changes - The fields to change; none is a plain read.
   * @returns The Goal as it now stands, or `undefined` when it isn't found.
   */
  update: async (
    householdId: string,
    goalId: string,
    changes: GoalChanges,
  ): Promise<Goal | undefined> => {
    const set = Object.fromEntries(Object.entries(changes)
      .filter(([, value]) => value !== undefined));
    const [row] = Object.keys(set).length > 0
      ? await db.update(goals).set(set).where(goalIs(householdId, goalId)).returning(goalColumns)
      : await db.select(goalColumns).from(goals).where(goalIs(householdId, goalId));
    return row && toGoal(row);
  },

  /**
   * Marks a Goal completed (FR-8.8). Completing it again keeps the first time.
   *
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @returns `true` when it exists.
   */
  complete: async (householdId: string, goalId: string): Promise<boolean> => (
    await db.update(goals).set({ completedAt: sql`coalesce(${goals.completedAt}, now())` })
      .where(goalIs(householdId, goalId)).returning({ id: goals.id })
  ).length > 0,

  /**
   * Reopens a completed Goal, back to active (FR-8.9). Reopening an active one
   * changes nothing.
   *
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @returns `true` when it exists.
   */
  reopen: async (householdId: string, goalId: string): Promise<boolean> => (
    await db.update(goals).set({ completedAt: null })
      .where(goalIs(householdId, goalId)).returning({ id: goals.id })
  ).length > 0,

  /**
   * Deletes a Goal, no history kept (FR-8.6, OQ-47): its allocations go with it
   * (FK cascade); the Holdings that funded it are untouched.
   *
   * @param householdId - The household.
   * @param goalId - The Goal.
   * @returns `true` when it existed.
   */
  delete: async (householdId: string, goalId: string): Promise<boolean> => (
    await db.delete(goals).where(goalIs(householdId, goalId)).returning({ id: goals.id })
  ).length > 0,

  /**
   * Lists allocations, oldest first: one Holding's (its Goal split), or those
   * funding some Goals (who funds them — FR-8.2 display, progress reads).
   *
   * @param filter - A Holding, or a set of Goals.
   * @returns The allocations.
   */
  listAllocations: async (filter: AllocationFilter): Promise<GoalAllocation[]> => {
    if ('goalIds' in filter && filter.goalIds.length === 0) return [];
    const where = 'holdingId' in filter
      ? eq(goalAllocations.holdingId, filter.holdingId)
      : inArray(goalAllocations.goalId, [...filter.goalIds]);
    return db.select(allocationColumns).from(goalAllocations).where(where)
      .orderBy(asc(goalAllocations.createdAt), asc(goalAllocations.id));
  },

  /**
   * Replaces a Holding's whole Goal split, all or nothing (FR-8.2/8.3, OQ-48):
   * refused when a Goal isn't this household's or the total passes 100%. Keyed by
   * Holding — the Manager has already loaded it within the household (OQ-167).
   * Each Goal appears at most once; ValidationUtility checks that (OQ-168).
   *
   * @param householdId - The Holding's household.
   * @param holdingId - The Holding.
   * @param shares - The new split; empty removes every allocation.
   * @returns `ok`, or why nothing was written.
   */
  replaceAllocations: (
    householdId: string,
    holdingId: string,
    shares: readonly AllocationShare[],
  ): Promise<ReplaceAllocationsResult> => db.transaction(async (tx) => {
    const [holding] = await tx.select({ id: investmentHoldings.id }).from(investmentHoldings)
      .where(eq(investmentHoldings.id, holdingId)).for('update');
    if (!holding) return { ok: false, reason: 'holding_not_found' };
    const goalIds = shares.map((share) => share.goalId);
    const foreignGoalId = await findForeignGoal(tx, householdId, goalIds);
    if (foreignGoalId) return { ok: false, reason: 'goal_not_found', goalId: foreignGoalId };
    const requested = totalOf(shares);
    if (requested > MAX_TOTAL_PERCENTAGE) {
      const current = await tx.select({ percentage: goalAllocations.percentage })
        .from(goalAllocations).where(eq(goalAllocations.holdingId, holdingId));
      return {
        ok: false, reason: 'allocation_exceeds_100', current: totalOf(current), requested,
      };
    }
    await tx.delete(goalAllocations).where(eq(goalAllocations.holdingId, holdingId));
    if (shares.length > 0) {
      await tx.insert(goalAllocations).values(shares.map((share) => ({ holdingId, ...share })));
    }
    return { ok: true };
  }),
});

/** The GoalAccessor's operations. */
export type GoalAccessor = ReturnType<typeof createGoalAccessor>;

export default createGoalAccessor;
