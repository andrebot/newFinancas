import {
  and, eq, gte, inArray, isNull, lt, or, sql, type SQL,
} from 'drizzle-orm';
import { getTableConfig, type PgColumn, type PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../db/database';
import { PG_FOREIGN_KEY_VIOLATION, pgConstraintName, pgErrorCode } from '../db/errors';
import { subcategories } from '../db/schema';

// Query pieces both ledgers' Accessors (A7, A8) build Browse & Filter from
// (FR-3.12, OQ-201): the same cursor, month ranges, Category rule and guards,
// each over the ledger's own columns. Pure SQL building, no reads of its own.

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

/** One month's sum of one kind in one currency, for ReportingEngine to sign. */
export interface MonthKindTotal {
  readonly month: string;
  readonly currency: string;
  readonly kind: string;
  readonly total: number;
}

/**
 * What a Budget claims (FR-4.6/4.8): whole Categories and single
 * Subcategories, matched on the row's own columns, as a spend's accrual is.
 */
export interface ClaimedCategories {
  readonly categoryIds: readonly string[];
  readonly subcategoryIds: readonly string[];
}

/** How many filtered transactions fall in a month (`YYYY-MM`). */
export interface MonthCount {
  readonly month: string;
  readonly count: number;
}

/**
 * Tells whether an optional list has items.
 *
 * @param values - The list.
 * @returns `true` when it has at least one.
 */
export const hasAny = (values: readonly string[] | undefined): values is readonly string[] => (
  values !== undefined && values.length > 0
);

/**
 * A column holding a value, `null` included.
 *
 * @param column - The column.
 * @param value - The value it must hold.
 * @returns The condition.
 */
export const holds = (column: PgColumn, value: boolean | string | number | null): SQL => (
  value === null ? isNull(column) : eq(column, value)
);

/**
 * The first day of the month after one.
 *
 * @param month - `YYYY-MM`.
 * @returns `YYYY-MM-DD`.
 */
export const firstDayAfter = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const next = monthNumber === 12 ? { year: year + 1, month: 1 } : { year, month: monthNumber + 1 };
  return `${next.year}-${String(next.month).padStart(2, '0')}-01`;
};

/**
 * Rows dated in one of some months, as date ranges the browse index can narrow.
 *
 * @param date - The ledger's date column.
 * @param months - The months (`YYYY-MM`).
 * @returns The condition.
 */
export const inMonths = (date: PgColumn, months: readonly string[]) => or(
  ...months.map((month) => and(gte(date, `${month}-01`), lt(date, firstDayAfter(month)))),
);

/**
 * A date column's month, as `YYYY-MM`.
 *
 * @param date - The ledger's date column.
 * @returns The expression.
 */
export const monthOf = (date: PgColumn) => sql<string>`to_char(${date}, 'YYYY-MM')`;

/**
 * The sum of an amount column, as a number.
 *
 * @param amount - The ledger's amount column.
 * @returns The aggregate.
 */
export const sumOf = (amount: PgColumn) => sql<number>`sum(${amount})`.mapWith(Number);

/** The number of rows in a group, as a number. */
export const countRows = sql<number>`count(*)::int`;

/**
 * Rows strictly after a cursor in newest-first order on (date, id).
 *
 * @param date - The ledger's date column.
 * @param id - The ledger's id column.
 * @param cursor - The previous page's last row, if any.
 * @returns The condition, or `undefined` for the first page.
 */
export const afterCursor = (date: PgColumn, id: PgColumn, cursor: LedgerCursor | undefined) => (
  cursor === undefined ? undefined : sql`(${date}, ${id}) < (${cursor.date}, ${cursor.id})`
);

/**
 * The Category condition (OQ-201, F8): a row in one of the Categories, or in
 * one of their Subcategories.
 *
 * @param db - Where the Subcategories are read.
 * @param columns - The ledger's Category and Subcategory columns.
 * @param categoryIds - The Categories.
 * @returns The condition, or `undefined` when none is given.
 */
export const inCategories = (
  db: Database,
  columns: { readonly categoryId: PgColumn; readonly subcategoryId: PgColumn },
  categoryIds: readonly string[] | undefined,
) => {
  if (!hasAny(categoryIds)) return undefined;
  const ownSubcategories = db.select({ id: subcategories.id }).from(subcategories)
    .where(inArray(subcategories.categoryId, [...categoryIds]));
  return or(
    inArray(columns.categoryId, [...categoryIds]),
    inArray(columns.subcategoryId, ownSubcategories),
  );
};

/**
 * The claims condition: a row naming a claimed Category, or a claimed
 * Subcategory — the same match a spend's accrual makes (OQ-166).
 *
 * @param columns - The ledger's Category and Subcategory columns.
 * @param claims - The claimed Categories and Subcategories.
 * @returns The condition; it matches nothing when nothing is claimed.
 */
export const inClaims = (
  columns: { readonly categoryId: PgColumn; readonly subcategoryId: PgColumn },
  claims: ClaimedCategories,
) => or(
  sql`false`,
  hasAny(claims.categoryIds) ? inArray(columns.categoryId, [...claims.categoryIds]) : undefined,
  hasAny(claims.subcategoryIds)
    ? inArray(columns.subcategoryId, [...claims.subcategoryIds])
    : undefined,
);

/**
 * The names of a ledger's foreign keys on its Category and Subcategory columns.
 *
 * @param table - The ledger's table.
 * @returns The constraint names.
 */
export const categoryForeignKeys = (table: PgTable): ReadonlySet<string> => new Set(
  getTableConfig(table).foreignKeys
    .filter((key) => key.reference().columns
      .some((column) => column.name === 'category_id' || column.name === 'subcategory_id'))
    .map((key) => key.getName()),
);

/**
 * Tells whether a write failed because something it names was deleted
 * meanwhile (OQ-203). Categories and Subcategories are archive-only (FR-10.3)
 * and checked by the Manager first, so their foreign keys never fail by a race:
 * such a failure is a bug, and is left to surface as one.
 *
 * @param error - What the write threw.
 * @param categoryKeys - The ledger's Category foreign keys (`categoryForeignKeys`).
 * @returns `true` for a vanished Account, Holding, card or recorder.
 */
export const isVanishedReference = (error: unknown, categoryKeys: ReadonlySet<string>) => (
  pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION
    && !categoryKeys.has(pgConstraintName(error) ?? '')
);
