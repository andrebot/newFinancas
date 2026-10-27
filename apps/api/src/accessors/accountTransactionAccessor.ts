import type { TransactionEffect } from '@financas/reference';
import {
  and, desc, eq, getTableColumns, gte, inArray, isNotNull, lte, ne, or, sql, type AnyColumn,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { accountTransactions, accounts, investmentHoldings } from '../db/schema';
import {
  afterCursor, categoryForeignKeys, countRows, hasAny, holds, inCategories, inMonths,
  isVanishedReference, monthOf, sumOf,
  type DayKindTotal, type LedgerCursor, type MonthCount, type MonthKindTotal,
} from './ledgerQuery';

export type {
  DayKindTotal, LedgerCursor, MonthCount, MonthKindTotal,
} from './ledgerQuery';

// AccountTransactionAccessor (A7, VBD): the Account Transaction ledger
// (FR-3.1–FR-3.12, 02-data-model.md). It applies data changes only. The kind's
// effect (EFFECT_BY_KIND), its direction, a trade's deltas, who may record or
// edit, and which Accounts the caller sees are TransactionManager's decisions.
// What stays here:
// - the effect is stored as given and read back as stored, never recomputed
//   from the kind, so history keeps the effect in force when it was written;
// - an edit or delete is guarded by the values the Manager read, so the undo it
//   computed from them still holds — otherwise it is `stale`;
// - Browse reads newest first on (date, id), and its day totals and month counts
//   cover the whole filtered set, whatever page the rows land on (OQ-201).

/** A trade's signed changes to its Holding, the exact undo of the trade (OQ-171). */
export interface TradeDeltas {
  /** 1e-8 units. */
  readonly quantityDelta: number;
  /** Minor units of the Account's currency. */
  readonly costBasisDelta: number;
}

/** Where a transaction came from: by hand, or posted by investmentsDaily (FR-11.3). */
export type TransactionSource = 'manual' | 'schedule';

export interface AccountTransaction {
  readonly id: string;
  readonly accountId: string;
  /** Reference data (FR-3.1), validated by the Manager. */
  readonly kind: string;
  readonly effect: TransactionEffect;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** Positive minor units; the kind says which way money moves (OQ-98). */
  readonly amount: number;
  readonly currency: string;
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  readonly description: string | null;
  /** Investment kinds only (FR-3.8). */
  readonly holdingId: string | null;
  /** The Holding the row and the edit form show (OQ-201). */
  readonly holding: { readonly ticker: string | null; readonly assetType: string } | null;
  /** Buy, sell and redemption only. */
  readonly trade: TradeDeltas | null;
  /** Bill payment only — the one bridge between the ledgers (FR-3.7). */
  readonly creditCardId: string | null;
  /** Null for schedule posts and once FR-1.17 anonymizes it. */
  readonly createdByUserId: string | null;
  readonly source: TransactionSource;
  readonly createdAt: Date;
}

/** A transaction to record, as the Manager decided it. */
export interface NewAccountTransaction {
  readonly accountId: string;
  readonly kind: string;
  readonly effect: TransactionEffect;
  readonly date: string;
  readonly amount: number;
  readonly currency: string;
  readonly categoryId?: string;
  readonly subcategoryId?: string;
  readonly description?: string;
  readonly holdingId?: string;
  readonly creditCardId?: string;
  readonly trade?: TradeDeltas;
  readonly source?: TransactionSource;
  readonly createdByUserId?: string;
}

export type InsertAccountTransactionResult = | {
  readonly ok: true; readonly transaction: AccountTransaction;
}
  /** An Account, Holding, card or recorder it names was deleted meanwhile (a race, OQ-203). */
  | { readonly ok: false; readonly reason: 'reference_not_found' };

/** The values an edit or delete was computed from (OQ-107's guarded write). */
export type ExpectedTransaction = Pick<
  AccountTransaction, 'date' | 'amount' | 'categoryId' | 'subcategoryId' | 'trade'
>;

/** What an edit may change: values, never kind or target (OQ-201, D6). */
export interface AccountTransactionChanges {
  readonly date?: string;
  readonly amount?: number;
  readonly categoryId?: string | null;
  readonly subcategoryId?: string | null;
  readonly description?: string | null;
  readonly trade?: TradeDeltas;
}

export type UpdateAccountTransactionResult = | {
  readonly status: 'updated'; readonly transaction: AccountTransaction;
}
  | { readonly status: 'stale' };

/** Browse & Filter's criteria (FR-3.12, OQ-201); every one given must hold. */
export interface AccountTransactionFilter {
  /** The Accounts the caller sees, already narrowed by the Manager; empty matches nothing. */
  readonly scopeAccountIds: readonly string[];
  /**
   * The Account/Card picker: a row matches when its Account, or its bill
   * payment's card, is picked.
   */
  readonly accountIds?: readonly string[];
  readonly creditCardIds?: readonly string[];
  readonly kinds?: readonly string[];
  /** A Category includes its Subcategories. */
  readonly categoryIds?: readonly string[];
  readonly holdingId?: string;
  /** Inclusive `YYYY-MM-DD` bounds. */
  readonly from?: string;
  readonly to?: string;
}

/** One month's sum of one kind and stored effect in one currency, for ReportingEngine. */
export interface MonthKindSum extends MonthKindTotal {
  readonly effect: TransactionEffect;
}

/** A Holding's cost basis on a date: the sum of its trades' deltas by then (OQ-206). */
export interface HoldingCostBasis {
  readonly holdingId: string;
  /** Minor units of the Account's currency. */
  readonly costBasis: number;
}

/**
 * One column of the transaction's Holding, read alongside the row — in a
 * SELECT or in a write's RETURNING alike.
 *
 * @param column - The Holding column.
 * @returns The subquery, `null` for a kind without a Holding.
 */
const holdingField = (column: AnyColumn) => sql<string | null>`(
  SELECT ${column} FROM ${investmentHoldings}
  WHERE ${investmentHoldings.id} = ${accountTransactions.holdingId})`;

const rowColumns = {
  ...getTableColumns(accountTransactions),
  holdingTicker: holdingField(investmentHoldings.ticker),
  holdingAssetType: holdingField(investmentHoldings.assetType),
};

const categoryKeys = categoryForeignKeys(accountTransactions);

type Row = typeof accountTransactions.$inferSelect & {
  readonly holdingTicker: string | null;
  readonly holdingAssetType: string | null;
};

const monthOfDate = monthOf(accountTransactions.date);
const sumOfAmounts = sumOf(accountTransactions.amount);

/**
 * Turns a row read with `rowColumns` into a transaction.
 *
 * @param row - The row, with its Holding's ticker and asset type.
 * @returns The transaction.
 */
const toTransaction = (row: Row): AccountTransaction => {
  const {
    quantityDelta, costBasisDelta, holdingTicker, holdingAssetType, ...rest
  } = row;
  return {
    ...rest,
    effect: rest.effect as TransactionEffect,
    source: rest.source as TransactionSource,
    holding: holdingAssetType === null
      ? null
      : { ticker: holdingTicker, assetType: holdingAssetType },
    trade: quantityDelta === null ? null : { quantityDelta, costBasisDelta: costBasisDelta! },
  };
};

/**
 * The picker's condition (OQ-201, F8): the picked Accounts and cards together.
 *
 * @param filter - The criteria.
 * @returns The condition, or `undefined` when nothing is picked.
 */
const pickerCondition = (filter: AccountTransactionFilter) => {
  const picked = [
    hasAny(filter.accountIds)
      ? inArray(accountTransactions.accountId, [...filter.accountIds])
      : undefined,
    hasAny(filter.creditCardIds)
      ? inArray(accountTransactions.creditCardId, [...filter.creditCardIds])
      : undefined,
  ].filter((condition) => condition !== undefined);
  return picked.length > 0 ? or(...picked) : undefined;
};

/**
 * Every filter criterion as one condition.
 *
 * @param db - Where the Subcategories are read.
 * @param filter - The criteria, with a non-empty scope.
 * @returns The condition.
 */
const filterCondition = (db: Database, filter: AccountTransactionFilter) => and(
  inArray(accountTransactions.accountId, [...filter.scopeAccountIds]),
  pickerCondition(filter),
  hasAny(filter.kinds) ? inArray(accountTransactions.kind, [...filter.kinds]) : undefined,
  inCategories(db, accountTransactions, filter.categoryIds),
  filter.holdingId === undefined ? undefined : eq(accountTransactions.holdingId, filter.holdingId),
  filter.from === undefined ? undefined : gte(accountTransactions.date, filter.from),
  filter.to === undefined ? undefined : lte(accountTransactions.date, filter.to),
);

/**
 * One transaction still holding the values an edit or delete was computed from.
 *
 * @param id - The transaction.
 * @param expected - What the Manager read.
 * @returns The condition.
 */
const unchanged = (id: string, expected: ExpectedTransaction) => and(
  eq(accountTransactions.id, id),
  eq(accountTransactions.date, expected.date),
  eq(accountTransactions.amount, expected.amount),
  holds(accountTransactions.categoryId, expected.categoryId),
  holds(accountTransactions.subcategoryId, expected.subcategoryId),
  holds(accountTransactions.quantityDelta, expected.trade?.quantityDelta ?? null),
  holds(accountTransactions.costBasisDelta, expected.trade?.costBasisDelta ?? null),
);

/**
 * The columns a new transaction writes, named one by one so a wider object can
 * never set its id or creation time.
 *
 * @param transaction - The transaction.
 * @returns The values to insert.
 */
const columnsToInsert = (transaction: NewAccountTransaction) => ({
  accountId: transaction.accountId,
  kind: transaction.kind,
  effect: transaction.effect,
  date: transaction.date,
  amount: transaction.amount,
  currency: transaction.currency,
  categoryId: transaction.categoryId,
  subcategoryId: transaction.subcategoryId,
  description: transaction.description,
  holdingId: transaction.holdingId,
  creditCardId: transaction.creditCardId,
  quantityDelta: transaction.trade?.quantityDelta,
  costBasisDelta: transaction.trade?.costBasisDelta,
  source: transaction.source,
  createdByUserId: transaction.createdByUserId,
});

/**
 * The columns an edit sets: only the values D6 lets change (OQ-201), named one
 * by one so a wider object can never move or re-kind the transaction.
 *
 * @param changes - The edit.
 * @returns The `set` object, without the fields left out.
 */
const columnsToSet = (changes: AccountTransactionChanges): Partial<Row> => {
  const allowed: { [Column in keyof Row]?: Row[Column] | undefined } = {
    date: changes.date,
    amount: changes.amount,
    categoryId: changes.categoryId,
    subcategoryId: changes.subcategoryId,
    description: changes.description,
    quantityDelta: changes.trade?.quantityDelta,
    costBasisDelta: changes.trade?.costBasisDelta,
  };
  return Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
};

/**
 * Builds the AccountTransactionAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createAccountTransactionAccessor = (db: Database) => ({
  /**
   * Records a transaction as the Manager decided it, effect included.
   *
   * @param transaction - The transaction.
   * @returns The recorded transaction, or why nothing was written.
   */
  insert: async (transaction: NewAccountTransaction): Promise<InsertAccountTransactionResult> => {
    try {
      const [row] = await db.insert(accountTransactions).values(columnsToInsert(transaction))
        .returning(rowColumns);
      return { ok: true, transaction: toTransaction(row!) };
    } catch (error) {
      if (isVanishedReference(error, categoryKeys)) {
        return { ok: false, reason: 'reference_not_found' };
      }
      throw error;
    }
  },

  /**
   * Reads one transaction of a household, through its Account.
   *
   * @param householdId - The household.
   * @param id - The transaction.
   * @returns The transaction, or `undefined`.
   */
  findById: async (householdId: string, id: string): Promise<AccountTransaction | undefined> => {
    const [row] = await db.select(rowColumns).from(accountTransactions)
      .innerJoin(accounts, eq(accounts.id, accountTransactions.accountId))
      .where(and(eq(accountTransactions.id, id), eq(accounts.householdId, householdId)));
    return row && toTransaction(row);
  },

  /**
   * Edits a transaction's values, if it still holds what the Manager read.
   * Keyed by id — the Manager has already loaded it within the household.
   *
   * @param id - The transaction.
   * @param expected - The values the edit was computed from.
   * @param changes - The fields to change.
   * @returns `updated` with the transaction as it now stands, or `stale`.
   */
  update: async (
    id: string,
    expected: ExpectedTransaction,
    changes: AccountTransactionChanges,
  ): Promise<UpdateAccountTransactionResult> => {
    const set = columnsToSet(changes);
    const query = Object.keys(set).length > 0
      ? db.update(accountTransactions).set(set).where(unchanged(id, expected))
        .returning(rowColumns)
      : db.select(rowColumns).from(accountTransactions).where(unchanged(id, expected));
    const [row] = await query;
    return row ? { status: 'updated', transaction: toTransaction(row) } : { status: 'stale' };
  },

  /**
   * Deletes a transaction, if it still holds what the Manager read; its
   * automatic Valuation Snapshot goes with it.
   *
   * @param id - The transaction.
   * @param expected - The values the delete's undo was computed from.
   * @returns `deleted`, or `stale`.
   */
  delete: async (id: string, expected: ExpectedTransaction): Promise<'deleted' | 'stale'> => {
    const deleted = await db.delete(accountTransactions).where(unchanged(id, expected))
      .returning({ id: accountTransactions.id });
    return deleted.length > 0 ? 'deleted' : 'stale';
  },

  /**
   * Counts the transactions referencing a Holding, but one (OQ-201, D7: is
   * anything but its buy left?).
   *
   * @param holdingId - The Holding.
   * @param exceptId - The transaction not to count.
   * @returns How many others reference it.
   */
  countForHolding: (holdingId: string, exceptId: string): Promise<number> => db.$count(
    accountTransactions,
    and(eq(accountTransactions.holdingId, holdingId), ne(accountTransactions.id, exceptId)),
  ),

  /**
   * Lists one page of the filtered transactions, newest first on (date, id).
   *
   * @param filter - The criteria.
   * @param cursor - The previous page's last row; none for the first page.
   * @param limit - At most this many rows.
   * @returns The page's rows.
   */
  list: async (
    filter: AccountTransactionFilter,
    cursor: LedgerCursor | undefined,
    limit: number,
  ): Promise<AccountTransaction[]> => {
    if (filter.scopeAccountIds.length === 0) return [];
    const rows = await db.select(rowColumns).from(accountTransactions)
      .where(and(
        filterCondition(db, filter),
        afterCursor(accountTransactions.date, accountTransactions.id, cursor),
      ))
      .orderBy(desc(accountTransactions.date), desc(accountTransactions.id))
      .limit(limit);
    return rows.map(toTransaction);
  },

  /**
   * Sums the filtered transactions of some days by currency and kind, over
   * the whole filtered set — not only one page's rows.
   *
   * @param filter - The criteria.
   * @param dates - The days (`YYYY-MM-DD`).
   * @returns One sum per day, currency and kind present, in no particular order.
   */
  dayTotals: async (
    filter: AccountTransactionFilter,
    dates: readonly string[],
  ): Promise<DayKindTotal[]> => {
    if (filter.scopeAccountIds.length === 0 || dates.length === 0) return [];
    return db.select({
      date: accountTransactions.date,
      currency: accountTransactions.currency,
      kind: accountTransactions.kind,
      total: sumOfAmounts,
    }).from(accountTransactions)
      .where(and(filterCondition(db, filter), inArray(accountTransactions.date, [...dates])))
      .groupBy(accountTransactions.date, accountTransactions.currency, accountTransactions.kind);
  },

  /**
   * Counts the filtered transactions of some months, over the whole filtered set.
   *
   * @param filter - The criteria.
   * @param months - The months (`YYYY-MM`).
   * @returns One count per month present, in no particular order.
   */
  monthCounts: async (
    filter: AccountTransactionFilter,
    months: readonly string[],
  ): Promise<MonthCount[]> => {
    if (filter.scopeAccountIds.length === 0 || months.length === 0) return [];
    return db.select({ month: monthOfDate, count: countRows })
      .from(accountTransactions)
      .where(and(filterCondition(db, filter), inMonths(accountTransactions.date, months)))
      .groupBy(monthOfDate);
  },

  /**
   * Sums some Accounts' transactions by month, currency, kind and stored
   * effect, for ReportingEngine to sign and exclude by effect (FR-3.6, FR-6.11).
   *
   * @param accountIds - The Accounts.
   * @param from - First day, inclusive (`YYYY-MM-DD`).
   * @param to - Last day, inclusive.
   * @returns One sum per group present, in no particular order.
   */
  monthlySums: async (
    accountIds: readonly string[],
    from: string,
    to: string,
  ): Promise<MonthKindSum[]> => {
    if (accountIds.length === 0) return [];
    const rows = await db.select({
      month: monthOfDate,
      currency: accountTransactions.currency,
      kind: accountTransactions.kind,
      effect: accountTransactions.effect,
      total: sumOfAmounts,
    }).from(accountTransactions)
      .where(and(
        inArray(accountTransactions.accountId, [...accountIds]),
        gte(accountTransactions.date, from),
        lte(accountTransactions.date, to),
      ))
      .groupBy(
        monthOfDate,
        accountTransactions.currency,
        accountTransactions.kind,
        accountTransactions.effect,
      );
    return rows.map((row) => ({ ...row, effect: row.effect as TransactionEffect }));
  },

  /**
   * Each Holding's cost basis on a date: the sum of its trades' cost-basis
   * deltas dated on or before it — a fixed-term Holding's value then, for
   * ReportingEngine (FR-8.7, OQ-51, OQ-206).
   *
   * @param holdingIds - The Holdings.
   * @param date - The date, inclusive (`YYYY-MM-DD`).
   * @returns One sum per Holding with a trade by then, in no particular order.
   */
  costBasisAsOf: async (
    holdingIds: readonly string[],
    date: string,
  ): Promise<HoldingCostBasis[]> => {
    if (holdingIds.length === 0) return [];
    const rows = await db.select({
      holdingId: accountTransactions.holdingId,
      costBasis: sumOf(accountTransactions.costBasisDelta),
    }).from(accountTransactions)
      .where(and(
        inArray(accountTransactions.holdingId, [...holdingIds]),
        isNotNull(accountTransactions.costBasisDelta),
        lte(accountTransactions.date, date),
      ))
      .groupBy(accountTransactions.holdingId);
    return rows.map((row) => ({ holdingId: row.holdingId!, costBasis: row.costBasis }));
  },
});

/** The AccountTransactionAccessor's operations. */
export type AccountTransactionAccessor = ReturnType<typeof createAccountTransactionAccessor>;

export default createAccountTransactionAccessor;
