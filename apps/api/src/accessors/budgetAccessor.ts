import {
  and, asc, desc, eq, inArray, ne, or, sql, TransactionRollbackError, type SQL,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '../db/errors';
import {
  budgetPeriods, budgetTargets, budgets, categories, subcategories,
} from '../db/schema';
import type { Visibility } from '../db/schema/values';
import { monthOf, type CalendarMonth, type MonthRange } from './calendarMonth';

// BudgetAccessor (A10, VBD): Budgets, their Category/Subcategory targets and their
// monthly Budget Periods (FR-4, 02-data-model.md). It applies data changes only;
// who may create, edit or delete a Budget is AccountManager's decision.
// Two FR-4.7 invariants live here, as the data model places them:
// - a literal duplicate claim is the partial unique index firing (23505);
// - the rollup half (a Category reserves its Subcategories) is a cross-row check
//   no index can express, made while holding the parent Category's row lock so
//   two concurrent claims on one Category tree run one after the other.
// Periods (FR-4.9, OQ-166): every target change writes the current month's
// period, so the target in effect for a month is the latest period at or before
// it; a period opened later by a spend copies that one.

/** One claim: a whole Category (with all its Subcategories, FR-4.6) or one Subcategory. */
export type BudgetTarget = { readonly categoryId: string } | { readonly subcategoryId: string };

/**
 * Whose Budgets a claim or a spend belongs to (FR-4.2, OQ-166): the household's
 * shared ones, or one member's personal ones. `ownerUserId` only matters for
 * `personal`; for `shared` it is provenance and ignored when matching.
 */
export interface BudgetScope {
  readonly householdId: string;
  readonly visibility: Visibility;
  readonly ownerUserId: string | null;
}

/** A calendar month in the app's time zone — the Manager works it out (OQ-104). */
export type BudgetMonth = CalendarMonth;

export interface Budget extends BudgetScope {
  readonly id: string;
  readonly name: string;
  readonly targetAmount: number;
  readonly currency: string;
  readonly targets: readonly BudgetTarget[];
  readonly createdAt: Date;
}

/** A Budget to create; its creator owns it (identity if personal, provenance if shared). */
export interface NewBudget extends BudgetScope {
  readonly ownerUserId: string;
  readonly name: string;
  readonly targetAmount: number;
  readonly currency: string;
}

/** What an edit may change (FR-4.9: never the currency or the scope). */
export interface BudgetChanges {
  readonly name?: string;
  readonly targetAmount?: number;
}

/** One month of a Budget: the target in effect then, and the spend accrued. */
export interface BudgetPeriod extends BudgetMonth {
  readonly targetAmount: number;
  readonly spendAmount: number;
  readonly createdAt: Date;
}

/** A Budget's latest period at or before a month (OQ-166, OQ-206). */
export interface BudgetPeriodOf extends BudgetPeriod {
  readonly budgetId: string;
}

/** Why a target set was refused; nothing of the write is kept. */
export type TargetRejection = | {
  /** Another Budget in the scope claims it, or its Category/Subcategories (FR-4.7). */
  readonly reason: 'target_claimed';
  readonly target: BudgetTarget;
  readonly claimedByBudgetId: string;
}
  /** No such Category/Subcategory in this household. */
  | { readonly reason: 'target_not_found'; readonly target: BudgetTarget };

export type InsertBudgetResult = | { readonly ok: true; readonly budget: Budget }
  | ({ readonly ok: false } & TargetRejection);

export type ReplaceTargetsResult = | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'not_found' }
  | ({ readonly ok: false } & TargetRejection);

/** A transaction's spend to count against the Budget that claims it (FR-4.5, FR-4.8). */
export interface Spend {
  /** The transaction's Account scope: a shared Account accrues to shared Budgets (OQ-166). */
  readonly scope: BudgetScope;
  readonly currency: string;
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  /** Minor units; negative to reverse an earlier accrual (edit, delete). */
  readonly amount: number;
  /** The transaction's date, `YYYY-MM-DD`. */
  readonly date: string;
}

/** The Budget whose targets are being written. */
interface ClaimOwner extends BudgetScope {
  readonly budgetId: string;
}

const budgetColumns = {
  id: budgets.id,
  householdId: budgets.householdId,
  ownerUserId: budgets.ownerUserId,
  name: budgets.name,
  targetAmount: budgets.targetAmount,
  currency: budgets.currency,
  visibility: budgets.visibility,
  createdAt: budgets.createdAt,
};

type BudgetRow = Omit<Budget, 'targets' | 'visibility'> & { readonly visibility: string };

/** A target row's two columns, exactly one set. */
interface TargetColumns {
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
}

/** The Budget fields a period snapshots (OQ-95). */
interface PeriodOwner {
  readonly id: string;
  readonly householdId: string;
  readonly currency: string;
}

const periodKey = [budgetPeriods.budgetId, budgetPeriods.year, budgetPeriods.month];

/**
 * The condition selecting target rows in one scope.
 *
 * @param scope - Household, visibility and (for personal) owner.
 * @returns The SQL condition.
 */
const inScope = (scope: BudgetScope) => and(
  eq(budgetTargets.householdId, scope.householdId),
  eq(budgetTargets.visibility, scope.visibility),
  scope.visibility === 'personal' ? eq(budgetTargets.ownerUserId, scope.ownerUserId!) : undefined,
);

/**
 * Compares a period's month with a given month.
 *
 * @param operator - The comparison.
 * @param month - The month to compare with.
 * @returns The SQL condition.
 */
const periodMonth = (operator: '<=' | '>=' | '>', month: BudgetMonth) => {
  const period = sql`(${budgetPeriods.year}, ${budgetPeriods.month})`;
  return sql`${period} ${sql.raw(operator)} (${month.year}, ${month.month})`;
};

/**
 * The row opening one month of a Budget.
 *
 * @param budget - The Budget's id, household and currency.
 * @param month - The month.
 * @param targetAmount - The target in effect that month.
 * @returns The `budget_periods` values.
 */
const periodValues = (budget: PeriodOwner, month: BudgetMonth, targetAmount: number) => ({
  budgetId: budget.id,
  householdId: budget.householdId,
  currency: budget.currency,
  year: month.year,
  month: month.month,
  targetAmount,
});

/**
 * Turns a target into its two columns, exactly one of them set.
 *
 * @param target - The claim.
 * @returns `categoryId` and `subcategoryId`.
 */
const targetColumns = (target: BudgetTarget) => ('categoryId' in target
  ? { categoryId: target.categoryId, subcategoryId: null }
  : { categoryId: null, subcategoryId: target.subcategoryId });

/**
 * Turns a target row back into a target.
 *
 * @param row - Its two columns, exactly one set.
 * @returns The claim.
 */
const toTarget = (row: TargetColumns): BudgetTarget => (
  row.categoryId ? { categoryId: row.categoryId } : { subcategoryId: row.subcategoryId! }
);

/**
 * The condition matching another claim on exactly this target.
 *
 * @param target - The claim.
 * @returns The SQL condition.
 */
const sameTarget = (target: BudgetTarget) => ('categoryId' in target
  ? eq(budgetTargets.categoryId, target.categoryId)
  : eq(budgetTargets.subcategoryId, target.subcategoryId));

/**
 * The condition matching a claim one level away in the same Category tree: a
 * Subcategory of a claimed Category, or the Category of a claimed Subcategory.
 *
 * @param db - Where to read (for the Subcategory sub-select).
 * @param target - The claim.
 * @param parentId - The target's Category.
 * @returns The SQL condition.
 */
const otherLevel = (db: Database, target: BudgetTarget, parentId: string) => ('categoryId' in target
  ? inArray(
    budgetTargets.subcategoryId,
    db.select({ id: subcategories.id }).from(subcategories)
      .where(eq(subcategories.categoryId, parentId)),
  )
  : eq(budgetTargets.categoryId, parentId));

/**
 * Locks the Category a target belongs to, if it is this household's.
 *
 * @param db - A transaction.
 * @param householdId - The Budget's household.
 * @param target - The claim.
 * @returns The Category's id, or `undefined` when the target isn't found there.
 */
const lockParentCategory = async (db: Database, householdId: string, target: BudgetTarget) => {
  const query = 'categoryId' in target
    ? db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, target.categoryId), eq(categories.householdId, householdId)))
    : db.select({ id: categories.id }).from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .where(and(
        eq(subcategories.id, target.subcategoryId),
        eq(categories.householdId, householdId),
      ));
  const [row] = await query.for('update', { of: categories });
  return row?.id;
};

/**
 * Finds which Budget in the owner's scope holds a matching claim.
 *
 * @param db - Where to read.
 * @param owner - The Budget being written (its scope).
 * @param condition - Which claims match.
 * @returns That Budget's id, or `undefined`.
 */
const findClaimant = async (db: Database, owner: ClaimOwner, condition: SQL | undefined) => {
  const [row] = await db.select({ budgetId: budgetTargets.budgetId }).from(budgetTargets)
    .where(and(inScope(owner), condition)).limit(1);
  return row?.budgetId;
};

/**
 * Inserts one target row, inside a savepoint so a refused claim leaves the
 * surrounding transaction usable.
 *
 * @param db - A transaction.
 * @param owner - The Budget claiming it.
 * @param target - The claim.
 * @returns `true`, or `false` when the FR-4.7 unique index refused it.
 */
const insertTarget = async (db: Database, owner: ClaimOwner, target: BudgetTarget) => {
  try {
    await db.transaction((tx) => tx.insert(budgetTargets).values({
      budgetId: owner.budgetId,
      householdId: owner.householdId,
      visibility: owner.visibility,
      ownerUserId: owner.ownerUserId,
      ...targetColumns(target),
    }));
    return true;
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) return false;
    throw error;
  }
};

/**
 * Claims one target for a Budget (FR-4.7): refused when it isn't this household's,
 * when the other level of its Category tree is claimed by another Budget in the
 * scope (rollup, checked here), or when it is itself claimed (the unique index).
 *
 * @param db - A transaction.
 * @param owner - The Budget claiming it.
 * @param target - The claim.
 * @returns `undefined` once claimed, or why not.
 */
const claimTarget = async (
  db: Database,
  owner: ClaimOwner,
  target: BudgetTarget,
): Promise<TargetRejection | undefined> => {
  const parentId = await lockParentCategory(db, owner.householdId, target);
  if (!parentId) return { reason: 'target_not_found', target };
  const rollup = await findClaimant(db, owner, and(
    otherLevel(db, target, parentId),
    ne(budgetTargets.budgetId, owner.budgetId),
  ));
  if (rollup) return { reason: 'target_claimed', target, claimedByBudgetId: rollup };
  if (await insertTarget(db, owner, target)) return undefined;
  const claimant = await findClaimant(db, owner, sameTarget(target));
  return { reason: 'target_claimed', target, claimedByBudgetId: claimant! };
};

/**
 * Claims targets one after the other, stopping at the first refusal.
 *
 * @param db - A transaction.
 * @param owner - The Budget claiming them.
 * @param targets - The claims.
 * @returns `undefined` once all are claimed, or the first refusal.
 */
const claimAll = (db: Database, owner: ClaimOwner, targets: readonly BudgetTarget[]) => targets
  .reduce<Promise<TargetRejection | undefined>>(
    async (previous, target) => (await previous) ?? claimTarget(db, owner, target),
    Promise.resolve(undefined),
  );

/**
 * Runs a write in a transaction and keeps it only when it succeeded: a result
 * with `ok: false` rolls everything back and is returned as is.
 *
 * @param db - Where to write.
 * @param work - The write.
 * @returns The write's result.
 */
const commitIfOk = async <Result extends { readonly ok: boolean }>(
  db: Database,
  work: (tx: Database) => Promise<Result>,
): Promise<Result> => {
  let outcome: Result | undefined;
  try {
    return await db.transaction(async (tx) => {
      outcome = await work(tx);
      if (!outcome.ok) tx.rollback();
      return outcome;
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) return outcome!;
    throw error;
  }
};

/**
 * Attaches each Budget's targets.
 *
 * @param db - Where to read.
 * @param rows - Budget rows.
 * @returns The Budgets.
 */
const withTargets = async (db: Database, rows: readonly BudgetRow[]): Promise<Budget[]> => {
  if (rows.length === 0) return [];
  const targets = await db.select({
    budgetId: budgetTargets.budgetId,
    categoryId: budgetTargets.categoryId,
    subcategoryId: budgetTargets.subcategoryId,
  }).from(budgetTargets)
    .where(inArray(budgetTargets.budgetId, rows.map((row) => row.id)))
    .orderBy(asc(budgetTargets.id));
  return rows.map((row) => ({
    ...row,
    visibility: row.visibility as Visibility,
    targets: targets.filter((target) => target.budgetId === row.id).map(toTarget),
  }));
};

/**
 * The condition selecting the Budgets a member can see in a household: every
 * shared one and their own personal ones (FR-4.2), optionally of one visibility.
 *
 * @param householdId - The household.
 * @param viewerUserId - The member.
 * @param visibility - Only this visibility, when given.
 * @returns The SQL condition.
 */
const visibleTo = (householdId: string, viewerUserId: string, visibility?: Visibility) => and(
  eq(budgets.householdId, householdId),
  or(
    eq(budgets.visibility, 'shared'),
    and(eq(budgets.visibility, 'personal'), eq(budgets.ownerUserId, viewerUserId)),
  ),
  visibility ? eq(budgets.visibility, visibility) : undefined,
);

/**
 * The condition selecting one Budget of a household.
 *
 * @param householdId - The household.
 * @param budgetId - The Budget.
 * @returns The SQL condition.
 */
const budgetIs = (householdId: string, budgetId: string) => and(
  eq(budgets.id, budgetId),
  eq(budgets.householdId, householdId),
);

/**
 * Applies an edit's changes to the Budget row.
 *
 * @param db - A transaction.
 * @param householdId - The household.
 * @param budgetId - The Budget.
 * @param changes - The fields to change; none is a plain read.
 * @returns The Budget's id and currency, or `undefined` when it isn't found.
 */
const applyChanges = async (
  db: Database,
  householdId: string,
  budgetId: string,
  changes: BudgetChanges,
) => {
  const set = Object.fromEntries(Object.entries(changes)
    .filter(([, value]) => value !== undefined));
  const columns = { id: budgets.id, currency: budgets.currency };
  const [row] = Object.keys(set).length > 0
    ? await db.update(budgets).set(set).where(budgetIs(householdId, budgetId)).returning(columns)
    : await db.select(columns).from(budgets).where(budgetIs(householdId, budgetId));
  return row;
};

/**
 * Puts a new target amount into effect from a month on (FR-4.9): the month's
 * period is written (opened if needed) and any later one already opened follows;
 * earlier periods keep theirs.
 *
 * @param db - A transaction.
 * @param budget - The Budget's id, household and currency.
 * @param targetAmount - The new target.
 * @param month - The current month.
 * @returns Resolves once written.
 */
const retarget = async (
  db: Database,
  budget: PeriodOwner,
  targetAmount: number,
  month: BudgetMonth,
) => {
  await db.insert(budgetPeriods).values(periodValues(budget, month, targetAmount))
    .onConflictDoUpdate({ target: periodKey, set: { targetAmount } });
  await db.update(budgetPeriods).set({ targetAmount })
    .where(and(eq(budgetPeriods.budgetId, budget.id), periodMonth('>', month)));
};

/**
 * Finds the Budget that claims a spend (FR-4.8): by its exact Subcategory, or by
 * its Category as a rollup — in the spend's scope and currency. FR-4.7 leaves at
 * most one such Budget in a scope, so no precedence is needed. Locks that Budget
 * so it can't be deleted before its period is written.
 *
 * @param db - A transaction.
 * @param spend - The spend.
 * @returns The Budget's id, or `undefined` when nothing claims it.
 */
const findClaimingBudget = async (db: Database, spend: Spend) => {
  const [row] = await db.select({ id: budgets.id }).from(budgetTargets)
    .innerJoin(budgets, eq(budgets.id, budgetTargets.budgetId))
    .where(and(
      inScope(spend.scope),
      eq(budgets.currency, spend.currency),
      or(
        spend.subcategoryId ? eq(budgetTargets.subcategoryId, spend.subcategoryId) : undefined,
        spend.categoryId ? eq(budgetTargets.categoryId, spend.categoryId) : undefined,
      ),
    ))
    .limit(1)
    .for('share', { of: budgets });
  return row?.id;
};

/**
 * Builds the BudgetAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createBudgetAccessor = (db: Database) => ({
  /**
   * Creates a Budget with its targets and opens the current month's period, all
   * or nothing.
   *
   * @param budget - The Budget.
   * @param targets - Its claims (FR-4.1: one or more).
   * @param month - The current month.
   * @returns The Budget, or why a target was refused.
   */
  insert: (
    budget: NewBudget,
    targets: readonly BudgetTarget[],
    month: BudgetMonth,
  ): Promise<InsertBudgetResult> => commitIfOk<InsertBudgetResult>(db, async (tx) => {
    const [row] = await tx.insert(budgets).values(budget).returning(budgetColumns);
    const rejection = await claimAll(tx, { ...budget, budgetId: row!.id }, targets);
    if (rejection) return { ok: false, ...rejection };
    await tx.insert(budgetPeriods).values(periodValues(row!, month, budget.targetAmount));
    return { ok: true, budget: { ...row!, visibility: budget.visibility, targets } };
  }),

  /**
   * Reads one Budget of a household, with its targets.
   *
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @returns The Budget, or `undefined`.
   */
  findById: async (householdId: string, budgetId: string): Promise<Budget | undefined> => {
    const rows = await db.select(budgetColumns).from(budgets)
      .where(budgetIs(householdId, budgetId));
    const [budget] = await withTargets(db, rows);
    return budget;
  },

  /**
   * Lists the Budgets a member can see (shared ones and their own personal ones),
   * by name — every one, as the claim-aware picker needs every claim (OQ-176).
   *
   * @param householdId - The household.
   * @param viewerUserId - The member.
   * @param filter - Only this visibility, when given.
   * @param filter.visibility - The visibility.
   * @returns The Budgets.
   */
  list: async (
    householdId: string,
    viewerUserId: string,
    filter: { readonly visibility?: Visibility | undefined } = {},
  ): Promise<Budget[]> => withTargets(
    db,
    await db.select(budgetColumns).from(budgets)
      .where(visibleTo(householdId, viewerUserId, filter.visibility))
      .orderBy(asc(budgets.name), asc(budgets.id)),
  ),

  /**
   * Edits a Budget's name and/or target amount; a new target applies from the
   * current month on (FR-4.9).
   *
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @param changes - The fields to change.
   * @param month - The current month.
   * @returns `updated`, or `not_found`.
   */
  update: (
    householdId: string,
    budgetId: string,
    changes: BudgetChanges,
    month: BudgetMonth,
  ): Promise<'updated' | 'not_found'> => db.transaction(async (tx) => {
    const row = await applyChanges(tx, householdId, budgetId, changes);
    if (!row) return 'not_found';
    if (changes.targetAmount !== undefined) {
      await retarget(tx, { ...row, householdId }, changes.targetAmount, month);
    }
    return 'updated';
  }),

  /**
   * Replaces a Budget's targets, all or nothing: claims it drops are released,
   * new ones must be free in its scope (FR-4.7).
   *
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @param targets - The new claims.
   * @returns `ok`, `not_found`, or why a target was refused.
   */
  replaceTargets: (
    householdId: string,
    budgetId: string,
    targets: readonly BudgetTarget[],
  ): Promise<ReplaceTargetsResult> => commitIfOk<ReplaceTargetsResult>(db, async (tx) => {
    const [row] = await tx.select({
      householdId: budgets.householdId,
      visibility: budgets.visibility,
      ownerUserId: budgets.ownerUserId,
    }).from(budgets).where(budgetIs(householdId, budgetId)).for('update');
    if (!row) return { ok: false, reason: 'not_found' };
    await tx.delete(budgetTargets).where(eq(budgetTargets.budgetId, budgetId));
    const owner = { ...row, visibility: row.visibility as Visibility, budgetId };
    const rejection = await claimAll(tx, owner, targets);
    return rejection ? { ok: false, ...rejection } : { ok: true };
  }),

  /**
   * Deletes a Budget (FR-4.10, OQ-40): its targets go with it, releasing their
   * claims; its periods stay, as history (`ON DELETE SET NULL`).
   *
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @returns `true` when it existed.
   */
  delete: async (householdId: string, budgetId: string): Promise<boolean> => (
    await db.delete(budgets).where(budgetIs(householdId, budgetId)).returning({ id: budgets.id })
  ).length > 0,

  /**
   * Lists a Budget's periods within a range of months, oldest first (FR-4.3/4.9).
   *
   * @param householdId - The household.
   * @param budgetId - The Budget.
   * @param range - The months; open ends reach the history's ends.
   * @returns The periods.
   */
  listPeriods: (
    householdId: string,
    budgetId: string,
    range: MonthRange = {},
  ): Promise<BudgetPeriod[]> => db.select({
    year: budgetPeriods.year,
    month: budgetPeriods.month,
    targetAmount: budgetPeriods.targetAmount,
    spendAmount: budgetPeriods.spendAmount,
    createdAt: budgetPeriods.createdAt,
  }).from(budgetPeriods)
    .where(and(
      eq(budgetPeriods.householdId, householdId),
      eq(budgetPeriods.budgetId, budgetId),
      range.from === undefined ? undefined : periodMonth('>=', range.from),
      range.to === undefined ? undefined : periodMonth('<=', range.to),
    ))
    .orderBy(asc(budgetPeriods.year), asc(budgetPeriods.month)),

  /**
   * Reads each Budget's latest period at or before a month, in one query — the
   * target in effect then and, when it is that month's, its spend (FR-4.3,
   * OQ-166; the Month Overview, OQ-206).
   *
   * @param householdId - The household.
   * @param budgetIds - The Budgets.
   * @param month - The month.
   * @returns At most one period per Budget; one with none by then is absent.
   */
  periodsAsOf: async (
    householdId: string,
    budgetIds: readonly string[],
    month: BudgetMonth,
  ): Promise<BudgetPeriodOf[]> => {
    if (budgetIds.length === 0) return [];
    return db.selectDistinctOn([budgetPeriods.budgetId], {
      // Never null here: only the given Budgets' periods are read.
      budgetId: sql<string>`${budgetPeriods.budgetId}`,
      year: budgetPeriods.year,
      month: budgetPeriods.month,
      targetAmount: budgetPeriods.targetAmount,
      spendAmount: budgetPeriods.spendAmount,
      createdAt: budgetPeriods.createdAt,
    }).from(budgetPeriods)
      .where(and(
        eq(budgetPeriods.householdId, householdId),
        inArray(budgetPeriods.budgetId, [...budgetIds]),
        periodMonth('<=', month),
      ))
      .orderBy(budgetPeriods.budgetId, desc(budgetPeriods.year), desc(budgetPeriods.month));
  },

  /**
   * Counts a spend against the Budget that claims it (FR-4.5/4.8), in the spend's
   * month: the period is opened if needed, with the target in effect then. A spend
   * nothing claims — or dated before the Budget's first period — isn't tracked.
   *
   * @param spend - The transaction's scope, currency, category, amount and date.
   * @returns `accrued`, or `untracked`.
   */
  accrueIfClaimed: async (spend: Spend): Promise<'accrued' | 'untracked'> => {
    if (!spend.categoryId && !spend.subcategoryId) return 'untracked';
    return db.transaction(async (tx) => {
      const budgetId = await findClaimingBudget(tx, spend);
      if (!budgetId) return 'untracked';
      const month = monthOf(spend.date);
      const [inEffect] = await tx.select({ targetAmount: budgetPeriods.targetAmount })
        .from(budgetPeriods)
        .where(and(eq(budgetPeriods.budgetId, budgetId), periodMonth('<=', month)))
        .orderBy(desc(budgetPeriods.year), desc(budgetPeriods.month))
        .limit(1);
      if (!inEffect) return 'untracked';
      const { householdId } = spend.scope;
      const owner = { id: budgetId, householdId, currency: spend.currency };
      await tx.insert(budgetPeriods).values({
        ...periodValues(owner, month, inEffect.targetAmount),
        spendAmount: spend.amount,
      }).onConflictDoUpdate({
        target: periodKey,
        set: { spendAmount: sql`${budgetPeriods.spendAmount} + excluded.spend_amount` },
      });
      return 'accrued';
    });
  },
});

/** The BudgetAccessor's operations. */
export type BudgetAccessor = ReturnType<typeof createBudgetAccessor>;

export default createBudgetAccessor;
