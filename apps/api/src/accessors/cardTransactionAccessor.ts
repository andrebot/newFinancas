import {
  and, desc, eq, getTableColumns, gte, inArray, lte,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { accounts, cardTransactions, creditCards } from '../db/schema';
import {
  afterCursor, categoryForeignKeys, countRows, hasAny, holds, inCategories, inClaims, inMonths,
  isVanishedReference, monthOf, sumOf,
  type ClaimedCategories, type DayKindTotal, type LedgerCursor, type MonthCount,
  type MonthKindTotal,
} from './ledgerQuery';

// CardTransactionAccessor (A8, VBD): the Card Transaction ledger, kept apart
// from Account Transactions (OQ-16; FR-3.1, FR-3.2, FR-3.12, 02-data-model.md).
// It applies data changes only. The sign of a charge or refund, who may record
// or edit, and which cards the caller sees and picked are TransactionManager's
// decisions; merging this ledger's page with the Account ledger's is too.
// What stays here:
// - an edit or delete is guarded by the values the Manager read, so the undo it
//   computed from them still holds — otherwise it is `stale`;
// - Browse reads newest first on (date, id), the same order and cursor as the
//   Account ledger, and its day totals and month counts cover the whole
//   filtered set, whatever page the rows land on (OQ-201).

export interface CardTransaction {
  readonly id: string;
  readonly creditCardId: string;
  /** `charge` or `refund` — reference data (FR-3.1), validated by the Manager. */
  readonly kind: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** Positive minor units; the kind says which way money moves (OQ-98). */
  readonly amount: number;
  readonly currency: string;
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  readonly description: string | null;
  /** Null once FR-1.17 anonymizes it. */
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
}

/** A transaction to record, as the Manager decided it. */
export interface NewCardTransaction {
  readonly creditCardId: string;
  readonly kind: string;
  readonly date: string;
  readonly amount: number;
  readonly currency: string;
  readonly categoryId?: string;
  readonly subcategoryId?: string;
  readonly description?: string;
  /** `null` for a post with no user behind it (VBD §3.2a) — card kinds never reach it. */
  readonly createdByUserId?: string | null;
}

export type InsertCardTransactionResult = | {
  readonly ok: true; readonly transaction: CardTransaction;
}
  /** The card or the recorder it names was deleted meanwhile (a race, OQ-203). */
  | { readonly ok: false; readonly reason: 'reference_not_found' };

/** The values an edit or delete was computed from (OQ-107's guarded write). */
export type ExpectedCardTransaction = Pick<
  CardTransaction, 'date' | 'amount' | 'categoryId' | 'subcategoryId'
>;

/** What an edit may change: values, never kind or card (OQ-201, D6). */
export interface CardTransactionChanges {
  readonly date?: string;
  readonly amount?: number;
  readonly categoryId?: string | null;
  readonly subcategoryId?: string | null;
  readonly description?: string | null;
}

export type UpdateCardTransactionResult = | {
  readonly status: 'updated'; readonly transaction: CardTransaction;
}
  | { readonly status: 'stale' };

/** Browse & Filter's criteria (FR-3.12, OQ-201); every one given must hold. */
export interface CardTransactionFilter {
  /**
   * The cards to read: those the caller sees, narrowed by the Account/Card
   * picker — both by the Manager. Empty matches nothing.
   */
  readonly creditCardIds: readonly string[];
  readonly kinds?: readonly string[];
  /** A Category includes its Subcategories. */
  readonly categoryIds?: readonly string[];
  /** Inclusive `YYYY-MM-DD` bounds. */
  readonly from?: string;
  readonly to?: string;
}

const rowColumns = getTableColumns(cardTransactions);
const categoryKeys = categoryForeignKeys(cardTransactions);
const monthOfDate = monthOf(cardTransactions.date);
const sumOfAmounts = sumOf(cardTransactions.amount);

/**
 * Every filter criterion as one condition.
 *
 * @param db - Where the Subcategories are read.
 * @param filter - The criteria, with at least one card.
 * @returns The condition.
 */
const filterCondition = (db: Database, filter: CardTransactionFilter) => and(
  inArray(cardTransactions.creditCardId, [...filter.creditCardIds]),
  hasAny(filter.kinds) ? inArray(cardTransactions.kind, [...filter.kinds]) : undefined,
  inCategories(db, cardTransactions, filter.categoryIds),
  filter.from === undefined ? undefined : gte(cardTransactions.date, filter.from),
  filter.to === undefined ? undefined : lte(cardTransactions.date, filter.to),
);

/**
 * One transaction still holding the values an edit or delete was computed from.
 *
 * @param id - The transaction.
 * @param expected - What the Manager read.
 * @returns The condition.
 */
const unchanged = (id: string, expected: ExpectedCardTransaction) => and(
  eq(cardTransactions.id, id),
  eq(cardTransactions.date, expected.date),
  eq(cardTransactions.amount, expected.amount),
  holds(cardTransactions.categoryId, expected.categoryId),
  holds(cardTransactions.subcategoryId, expected.subcategoryId),
);

/**
 * The columns a new transaction writes, named one by one so a wider object can
 * never set its id or creation time.
 *
 * @param transaction - The transaction.
 * @returns The values to insert.
 */
const columnsToInsert = (transaction: NewCardTransaction) => ({
  creditCardId: transaction.creditCardId,
  kind: transaction.kind,
  date: transaction.date,
  amount: transaction.amount,
  currency: transaction.currency,
  categoryId: transaction.categoryId,
  subcategoryId: transaction.subcategoryId,
  description: transaction.description,
  createdByUserId: transaction.createdByUserId,
});

/**
 * The columns an edit sets: only the values D6 lets change (OQ-201), named one
 * by one so a wider object can never move the transaction to another card or kind.
 *
 * @param changes - The edit.
 * @returns The `set` object, without the fields left out.
 */
const columnsToSet = (changes: CardTransactionChanges): Partial<CardTransaction> => {
  const allowed: { [Column in keyof CardTransaction]?: CardTransaction[Column] | undefined } = {
    date: changes.date,
    amount: changes.amount,
    categoryId: changes.categoryId,
    subcategoryId: changes.subcategoryId,
    description: changes.description,
  };
  return Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
};

/**
 * Builds the CardTransactionAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createCardTransactionAccessor = (db: Database) => ({
  /**
   * Records a charge or refund as the Manager decided it.
   *
   * @param transaction - The transaction.
   * @returns The recorded transaction, or why nothing was written.
   */
  insert: async (transaction: NewCardTransaction): Promise<InsertCardTransactionResult> => {
    try {
      const [row] = await db.insert(cardTransactions).values(columnsToInsert(transaction))
        .returning(rowColumns);
      return { ok: true, transaction: row! };
    } catch (error) {
      if (isVanishedReference(error, categoryKeys)) {
        return { ok: false, reason: 'reference_not_found' };
      }
      throw error;
    }
  },

  /**
   * Reads one transaction of a household, through its card's Account.
   *
   * @param householdId - The household.
   * @param id - The transaction.
   * @returns The transaction, or `undefined`.
   */
  findById: async (householdId: string, id: string): Promise<CardTransaction | undefined> => {
    const [row] = await db.select(rowColumns).from(cardTransactions)
      .innerJoin(creditCards, eq(creditCards.id, cardTransactions.creditCardId))
      .innerJoin(accounts, eq(accounts.id, creditCards.accountId))
      .where(and(eq(cardTransactions.id, id), eq(accounts.householdId, householdId)));
    return row;
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
    expected: ExpectedCardTransaction,
    changes: CardTransactionChanges,
  ): Promise<UpdateCardTransactionResult> => {
    const set = columnsToSet(changes);
    const query = Object.keys(set).length > 0
      ? db.update(cardTransactions).set(set).where(unchanged(id, expected)).returning(rowColumns)
      : db.select(rowColumns).from(cardTransactions).where(unchanged(id, expected));
    const [row] = await query;
    return row ? { status: 'updated', transaction: row } : { status: 'stale' };
  },

  /**
   * Deletes a transaction, if it still holds what the Manager read.
   *
   * @param id - The transaction.
   * @param expected - The values the delete's undo was computed from.
   * @returns `deleted`, or `stale`.
   */
  delete: async (id: string, expected: ExpectedCardTransaction): Promise<'deleted' | 'stale'> => {
    const deleted = await db.delete(cardTransactions).where(unchanged(id, expected))
      .returning({ id: cardTransactions.id });
    return deleted.length > 0 ? 'deleted' : 'stale';
  },

  /**
   * Lists one page of the filtered transactions, newest first on (date, id).
   *
   * @param filter - The criteria.
   * @param cursor - The previous page's last row; none for the first page.
   * @param limit - At most this many rows.
   * @returns The page's rows.
   */
  list: async (
    filter: CardTransactionFilter,
    cursor: LedgerCursor | undefined,
    limit: number,
  ): Promise<CardTransaction[]> => {
    if (filter.creditCardIds.length === 0) return [];
    return db.select(rowColumns).from(cardTransactions)
      .where(and(
        filterCondition(db, filter),
        afterCursor(cardTransactions.date, cardTransactions.id, cursor),
      ))
      .orderBy(desc(cardTransactions.date), desc(cardTransactions.id))
      .limit(limit);
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
    filter: CardTransactionFilter,
    dates: readonly string[],
  ): Promise<DayKindTotal[]> => {
    if (filter.creditCardIds.length === 0 || dates.length === 0) return [];
    return db.select({
      date: cardTransactions.date,
      currency: cardTransactions.currency,
      kind: cardTransactions.kind,
      total: sumOfAmounts,
    }).from(cardTransactions)
      .where(and(filterCondition(db, filter), inArray(cardTransactions.date, [...dates])))
      .groupBy(cardTransactions.date, cardTransactions.currency, cardTransactions.kind);
  },

  /**
   * Counts the filtered transactions of some months, over the whole filtered set.
   *
   * @param filter - The criteria.
   * @param months - The months (`YYYY-MM`).
   * @returns One count per month present, in no particular order.
   */
  monthCounts: async (
    filter: CardTransactionFilter,
    months: readonly string[],
  ): Promise<MonthCount[]> => {
    if (filter.creditCardIds.length === 0 || months.length === 0) return [];
    return db.select({ month: monthOfDate, count: countRows })
      .from(cardTransactions)
      .where(and(filterCondition(db, filter), inMonths(cardTransactions.date, months)))
      .groupBy(monthOfDate);
  },

  /**
   * Sums some cards' charges and refunds by month, currency and kind, for
   * ReportingEngine to sign (FR-6.11).
   *
   * @param creditCardIds - The cards.
   * @param from - First day, inclusive (`YYYY-MM-DD`).
   * @param to - Last day, inclusive.
   * @returns One sum per group present, in no particular order.
   */
  monthlySums: async (
    creditCardIds: readonly string[],
    from: string,
    to: string,
  ): Promise<MonthKindTotal[]> => {
    if (creditCardIds.length === 0) return [];
    return db.select({
      month: monthOfDate,
      currency: cardTransactions.currency,
      kind: cardTransactions.kind,
      total: sumOfAmounts,
    }).from(cardTransactions)
      .where(and(
        inArray(cardTransactions.creditCardId, [...creditCardIds]),
        gte(cardTransactions.date, from),
        lte(cardTransactions.date, to),
      ))
      .groupBy(monthOfDate, cardTransactions.currency, cardTransactions.kind);
  },

  /**
   * Sums some cards' charges and refunds in a Budget's claims by month,
   * currency and kind, from a day on — for AccountManager to restate the
   * Budget's spend (FR-4.5, OQ-166).
   *
   * @param creditCardIds - The cards in the Budget's scope.
   * @param claims - The Budget's Categories and Subcategories.
   * @param from - First day, inclusive (`YYYY-MM-DD`); no end.
   * @returns One sum per group present, in no particular order.
   */
  claimedSums: async (
    creditCardIds: readonly string[],
    claims: ClaimedCategories,
    from: string,
  ): Promise<MonthKindTotal[]> => {
    if (creditCardIds.length === 0) return [];
    return db.select({
      month: monthOfDate,
      currency: cardTransactions.currency,
      kind: cardTransactions.kind,
      total: sumOfAmounts,
    }).from(cardTransactions)
      .where(and(
        inArray(cardTransactions.creditCardId, [...creditCardIds]),
        inClaims(cardTransactions, claims),
        gte(cardTransactions.date, from),
      ))
      .groupBy(monthOfDate, cardTransactions.currency, cardTransactions.kind);
  },
});

/** The CardTransactionAccessor's operations. */
export type CardTransactionAccessor = ReturnType<typeof createCardTransactionAccessor>;

export default createCardTransactionAccessor;
