import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  afterCursor, categoryForeignKeys, countRows, firstDayAfter, hasAny, holds, inCategories,
  inMonths, isVanishedReference, monthOf, sumOf,
} from '../../../src/accessors/ledgerQuery';
import type { Database } from '../../../src/db/database';
import { cardTransactions } from '../../../src/db/schema';

// Builds queries without a connection; nothing here runs one.
const db = drizzle.mock() as unknown as Database;

const dialect = new PgDialect();

/**
 * Renders a condition as Postgres SQL and its parameters.
 *
 * @param condition - The condition.
 * @returns `{ sql, params }`.
 */
const render = (condition: Parameters<PgDialect['sqlToQuery']>[0]) => {
  const { sql, params } = dialect.sqlToQuery(condition);
  return { sql, params };
};

describe('hasAny', () => {
  it('tells a list with items from an empty or missing one', () => {
    expect(hasAny(['a'])).toBe(true);
    expect(hasAny([])).toBe(false);
    expect(hasAny(undefined)).toBe(false);
  });
});

describe('holds', () => {
  it('compares with a value, and matches null with IS NULL', () => {
    expect(render(holds(cardTransactions.amount, 5))).toEqual({
      sql: '"card_transactions"."amount" = $1', params: [5],
    });
    expect(render(holds(cardTransactions.categoryId, null)).sql)
      .toBe('"card_transactions"."category_id" is null');
  });
});

describe('firstDayAfter', () => {
  it('names the next month\'s first day, December into January', () => {
    expect(firstDayAfter('2026-09')).toBe('2026-10-01');
    expect(firstDayAfter('2026-12')).toBe('2027-01-01');
  });
});

describe('inMonths', () => {
  it('turns each month into a date range', () => {
    const { sql, params } = render(inMonths(cardTransactions.date, ['2026-12'])!);

    expect(sql).toContain('"card_transactions"."date" >= $1');
    expect(sql).toContain('"card_transactions"."date" < $2');
    expect(params).toEqual(['2026-12-01', '2027-01-01']);
  });
});

describe('afterCursor', () => {
  it('reads the first page without a condition, then strictly after the cursor', () => {
    expect(afterCursor(cardTransactions.date, cardTransactions.id, undefined)).toBeUndefined();
    expect(render(afterCursor(cardTransactions.date, cardTransactions.id, {
      date: '2026-10-05', id: 'x',
    })!)).toEqual({
      sql: '("card_transactions"."date", "card_transactions"."id") < ($1, $2)',
      params: ['2026-10-05', 'x'],
    });
  });
});

describe('monthOf, sumOf and countRows', () => {
  it('render the month, the amount sum and the row count', () => {
    expect(render(monthOf(cardTransactions.date)).sql)
      .toBe('to_char("card_transactions"."date", \'YYYY-MM\')');
    expect(render(sumOf(cardTransactions.amount)).sql).toBe('sum("card_transactions"."amount")');
    expect(render(countRows).sql).toBe('count(*)::int');
  });
});

describe('inCategories', () => {
  it('adds nothing without Categories', () => {
    expect(inCategories(db, cardTransactions, undefined)).toBeUndefined();
    expect(inCategories(db, cardTransactions, [])).toBeUndefined();
  });

  it('matches the Categories, or a Subcategory of one of them', () => {
    const { sql, params } = render(inCategories(db, cardTransactions, ['food'])!);

    expect(sql).toContain('"card_transactions"."category_id" in ($1)');
    expect(sql).toContain(
      '"card_transactions"."subcategory_id" in (select "id" from "subcategories"',
    );
    expect(sql).toContain('"subcategories"."category_id" in ($2)');
    expect(params).toEqual(['food', 'food']);
  });
});

describe('categoryForeignKeys', () => {
  it('names the ledger\'s Category and Subcategory foreign keys only', () => {
    expect([...categoryForeignKeys(cardTransactions)].sort()).toEqual([
      'card_transactions_category_id_categories_id_fk',
      'card_transactions_subcategory_id_subcategories_id_fk',
    ]);
  });
});

describe('isVanishedReference', () => {
  const categoryKeys = new Set(['category_fk']);

  /**
   * Builds a Drizzle-shaped query error.
   *
   * @param code - The SQLSTATE.
   * @param constraint - The violated constraint, if any.
   * @returns The error.
   */
  const queryError = (code: string, constraint?: string) => new Error('Failed query', {
    cause: { code, ...(constraint === undefined ? {} : { constraint }) },
  });

  it('is a race when another foreign key fails', () => {
    expect(isVanishedReference(queryError('23503', 'card_fk'), categoryKeys)).toBe(true);
    expect(isVanishedReference(queryError('23503'), categoryKeys)).toBe(true);
  });

  it('is not a race for a Category key or any other failure', () => {
    expect(isVanishedReference(queryError('23503', 'category_fk'), categoryKeys)).toBe(false);
    expect(isVanishedReference(queryError('23514', 'card_fk'), categoryKeys)).toBe(false);
  });
});
