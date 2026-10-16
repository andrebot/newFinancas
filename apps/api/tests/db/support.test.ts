import type { PGlite } from '@electric-sql/pglite';
import { sql, TransactionRollbackError } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import { createMigratedDatabase, withRollback } from './support/database';

// The DB test harness itself: a test must fail when the code under test lets an
// error out — even Drizzle's own rollback error — never pass with its remaining
// assertions skipped.

let pglite: PGlite;

beforeAll(async () => {
  pglite = await createMigratedDatabase();
});

afterAll(async () => {
  await pglite.close();
});

/**
 * Counts the households currently stored.
 *
 * @returns The row count.
 */
const householdCount = async (): Promise<number> => {
  const { rows } = await pglite.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM households',
  );
  return rows[0]!.count;
};

describe('withRollback', () => {
  it('runs the work as the application role and undoes its writes', async () => {
    let role: unknown;

    await withRollback(pglite, async (db) => {
      await db.execute(sql`INSERT INTO households (name) VALUES ('Home')`);
      const result = await db.execute(sql`SELECT current_user AS role`);
      role = (result as { rows: { role: string }[] }).rows[0]?.role;
    });

    expect(role).toBe('financas_app');
    expect(await householdCount()).toBe(0);
  });

  it('fails when the code under test lets a TransactionRollbackError out', async () => {
    const run = withRollback(pglite, async () => {
      throw new TransactionRollbackError();
    });

    await expect(run).rejects.toBeInstanceOf(TransactionRollbackError);
  });

  it('fails with any other error the work throws, and still undoes its writes', async () => {
    const run = withRollback(pglite, async (db) => {
      await db.execute(sql`INSERT INTO households (name) VALUES ('Home')`);
      throw new Error('assertion failed');
    });

    await expect(run).rejects.toThrow('assertion failed');
    expect(await householdCount()).toBe(0);
  });
});
