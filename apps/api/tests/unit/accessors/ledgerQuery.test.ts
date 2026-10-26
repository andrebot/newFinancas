import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  afterCursor, firstDayAfter, hasAny, holds, inMonths,
} from '../../../src/accessors/ledgerQuery';
import { cardTransactions } from '../../../src/db/schema';

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
