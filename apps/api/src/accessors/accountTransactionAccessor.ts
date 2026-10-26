import type { TransactionEffect } from '@financas/reference';
import {
  and, desc, eq, getTableColumns, gte, inArray, isNull, lt, lte, ne, or, sql,
  type AnyColumn, type SQL,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { PG_FOREIGN_KEY_VIOLATION, pgErrorCode } from '../db/errors';
import {
  accountTransactions, accounts, investmentHoldings, subcategories,
} from '../db/schema';

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
  /** An Account, Category, Holding, card or user it names is gone (a race). */
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

/** Where a page continues: the last row of the previous one. */
export interface LedgerCursor {
  readonly date: string;
  readonly id: string;
}

/** One day's sum of one kind in one currency, signed by the Manager. */
export interface DayKindTotal {
  readonly date: string;
  readonly currency: string;
  readonly kind: string;
  readonly total: number;
}

/** How many filtered transactions fall in a month (`YYYY-MM`). */
export interface MonthCount {
  readonly month: string;
  readonly count: number;
}

/** One month's sum of one kind and stored effect in one currency, for ReportingEngine. */
export interface MonthKindSum {
  readonly month: string;
  readonly currency: string;
  readonly kind: string;
  readonly effect: TransactionEffect;
  readonly total: number;
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

type Row = typeof accountTransactions.$inferSelect & {
  readonly holdingTicker: string | null;
  readonly holdingAssetType: string | null;
};

const monthOfDate = sql<string>`to_char(${accountTransactions.date}, 'YYYY-MM')`;
const sumOfAmounts = sql<number>`sum(${accountTransactions.amount})`.mapWith(Number);

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
 * The first day of the month after one.
 *
 * @param month - `YYYY-MM`.
 * @returns `YYYY-MM-DD`.
 */
const firstDayAfter = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const next = monthNumber === 12 ? { year: year + 1, month: 1 } : { year, month: monthNumber + 1 };
  return `${next.year}-${String(next.month).padStart(2, '0')}-01`;
};

/**
 * Rows dated in one of some months, as date ranges the browse index can narrow.
 *
 * @param months - The months (`YYYY-MM`).
 * @returns The condition.
 */
const inMonths = (months: readonly string[]) => or(...months.map((month) => and(
  gte(accountTransactions.date, `${month}-01`),
  lt(accountTransactions.date, firstDayAfter(month)),
)));

/**
 * Tells whether an optional list has items.
 *
 * @param values - The list.
 * @returns `true` when it has at least one.
 */
const hasAny = (values: readonly string[] | undefined): values is readonly string[] => (
  values !== undefined && values.length > 0
);

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
 * The Category condition: a row in one of the Categories, or in one of their Subcategories.
 *
 * @param db - Where the Subcategories are read.
 * @param categoryIds - The Categories.
 * @returns The condition, or `undefined` when none is given.
 */
const categoryCondition = (db: Database, categoryIds: readonly string[] | undefined) => {
  if (!hasAny(categoryIds)) return undefined;
  const ownSubcategories = db.select({ id: subcategories.id }).from(subcategories)
    .where(inArray(subcategories.categoryId, [...categoryIds]));
  return or(
    inArray(accountTransactions.categoryId, [...categoryIds]),
    inArray(accountTransactions.subcategoryId, ownSubcategories),
  );
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
  categoryCondition(db, filter.categoryIds),
  filter.holdingId === undefined ? undefined : eq(accountTransactions.holdingId, filter.holdingId),
  filter.from === undefined ? undefined : gte(accountTransactions.date, filter.from),
  filter.to === undefined ? undefined : lte(accountTransactions.date, filter.to),
);

/**
 * Rows strictly after a cursor in newest-first order.
 *
 * @param cursor - The previous page's last row, if any.
 * @returns The condition, or `undefined` for the first page.
 */
const afterCursor = (cursor: LedgerCursor | undefined) => (cursor === undefined
  ? undefined
  : sql`(${accountTransactions.date}, ${accountTransactions.id}) < (${cursor.date}, ${cursor.id})`);

/**
 * A column holding a value, `null` included.
 *
 * @param column - The column.
 * @param value - The value it must hold.
 * @returns The condition.
 */
const holds = (column: AnyColumn, value: string | number | null): SQL => (
  value === null ? isNull(column) : eq(column, value)
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
    const { trade, ...values } = transaction;
    try {
      const [row] = await db.insert(accountTransactions).values({
        ...values, quantityDelta: trade?.quantityDelta, costBasisDelta: trade?.costBasisDelta,
      }).returning(rowColumns);
      return { ok: true, transaction: toTransaction(row!) };
    } catch (error) {
      if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
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
      .where(and(filterCondition(db, filter), afterCursor(cursor)))
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
    return db.select({ month: monthOfDate, count: sql<number>`count(*)::int` })
      .from(accountTransactions)
      .where(and(filterCondition(db, filter), inMonths(months)))
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
});

/** The AccountTransactionAccessor's operations. */
export type AccountTransactionAccessor = ReturnType<typeof createAccountTransactionAccessor>;

export default createAccountTransactionAccessor;
