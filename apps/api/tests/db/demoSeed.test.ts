import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import applyDemoSeed from '../../src/db/seed/applyDemoSeed';
import { buildDemoSeed } from '../../src/db/seed/demoSeed';
import { createMigratedDatabase } from './support/database';

const TABLES = [
  'users', 'households', 'household_memberships', 'categories', 'subcategories', 'accounts',
  'credit_cards', 'account_month_balances', 'credit_card_month_balances', 'index_rate_values',
];

let database: PGlite;

/**
 * Counts the rows of every seeded table.
 *
 * @returns Row count per table.
 */
const rowCounts = async (): Promise<Record<string, number>> => Object.fromEntries(await Promise.all(
  TABLES.map(async (table) => {
    const { rows } = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${table}`,
    );
    return [table, rows[0]!.count] as const;
  }),
));

beforeAll(async () => {
  database = await createMigratedDatabase();
  // The real seed connects as the application role; prove that is enough.
  await database.exec('SET ROLE financas_app');
});

afterAll(async () => {
  await database.close();
});

describe('applyDemoSeed (PGlite, as the application role)', () => {
  it('inserts the demo household, and inserts nothing new when run again', async () => {
    const seed = buildDemoSeed(new Date('2026-10-08T12:00:00Z'));

    await applyDemoSeed(drizzle(database), seed);
    const first = await rowCounts();
    await applyDemoSeed(drizzle(database), seed);

    expect(first).toEqual({
      users: 2,
      households: 1,
      household_memberships: 2,
      categories: 6,
      subcategories: 6,
      accounts: 4,
      credit_cards: 1,
      account_month_balances: 4,
      credit_card_month_balances: 1,
      index_rate_values: 4,
    });
    expect(await rowCounts()).toEqual(first);
  });
});
