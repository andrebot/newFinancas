import { expect, test } from '@playwright/test';
import pg from 'pg';

// Smoke: the migrated schema behaves as the data model requires, seen from the
// application role the API connects as (real database, no mocks).

const PERMISSION_DENIED = '42501';
const UNIQUE_VIOLATION = '23505';

/**
 * Runs `work` inside a transaction as the application role, then rolls back so
 * the smoke run leaves no data behind.
 *
 * @param work - Queries to run with the connected client.
 * @returns Whatever `work` returns.
 */
const asAppRole = async <T>(work: (client: pg.Client) => Promise<T>): Promise<T> => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_TEST_URL });
  await client.connect();
  await client.query('BEGIN');
  try {
    return await work(client);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
};

/**
 * Runs one statement inside a savepoint: keeps its effect when it succeeds, undoes
 * it and reports the Postgres error code when it fails.
 *
 * @param client - A client inside a transaction.
 * @param statement - SQL to run.
 * @param values - Statement parameters.
 * @returns The SQLSTATE code, or `undefined` if the statement succeeded.
 */
const errorCodeOf = async (client: pg.Client, statement: string, values: unknown[] = []) => {
  await client.query('SAVEPOINT attempt');
  try {
    await client.query(statement, values);
    await client.query('RELEASE SAVEPOINT attempt');
    return undefined;
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT attempt');
    return (error as { code?: string }).code;
  }
};

/**
 * Inserts a user with placeholder credentials.
 *
 * @param client - A connected client.
 * @param email - Unique email.
 * @returns The new user's id.
 */
const insertUser = async (client: pg.Client, email: string): Promise<string> => {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, first_name, last_name, mfa_secret)
     VALUES ($1, 'x', 'Test', 'User', 'x') RETURNING id`,
    [email],
  );
  return rows[0]!.id;
};

test('all 26 v1 tables exist, with uuidv7 primary keys', { tag: '@smoke' }, async () => {
  await asAppRole(async (client) => {
    const { rows } = await client.query<{ count: string }>(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const id = await insertUser(client, 'uuid@example.com');

    expect(Number(rows[0]!.count)).toBe(26);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });
});

test('a household can have only one Owner', { tag: '@smoke' }, async () => {
  await asAppRole(async (client) => {
    const owner = await insertUser(client, 'owner@example.com');
    const other = await insertUser(client, 'other@example.com');
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO households (name) VALUES ('Home') RETURNING id",
    );
    const insertMember = `INSERT INTO household_memberships (household_id, user_id, role)
                          VALUES ($1, $2, $3)`;
    await client.query(insertMember, [rows[0]!.id, owner, 'Owner']);

    const household = rows[0]!.id;

    expect(await errorCodeOf(client, insertMember, [household, other, 'Owner']))
      .toBe(UNIQUE_VIOLATION);
    expect(await errorCodeOf(client, insertMember, [household, other, 'Admin'])).toBeUndefined();
  });
});

test('the audit log is append-only for the application role', { tag: '@smoke' }, async () => {
  await asAppRole(async (client) => {
    const insert = `INSERT INTO audit_log_entries (action, entity_type, entity_id)
                    VALUES ('test', 'test', uuidv7())`;

    expect(await errorCodeOf(client, insert)).toBeUndefined();
    expect(await errorCodeOf(client, "UPDATE audit_log_entries SET action = 'x'"))
      .toBe(PERMISSION_DENIED);
    expect(await errorCodeOf(client, 'DELETE FROM audit_log_entries')).toBe(PERMISSION_DENIED);
  });
});

test('the application role cannot change the schema', { tag: '@smoke' }, async () => {
  await asAppRole(async (client) => {
    expect(await errorCodeOf(client, 'CREATE TABLE probe (x int)')).toBe(PERMISSION_DENIED);
    expect(await errorCodeOf(client, 'DROP TABLE users')).not.toBeUndefined();
  });
});

test('a category is claimed once per budget scope (FR-4.7)', { tag: '@smoke' }, async () => {
  await asAppRole(async (client) => {
    const ana = await insertUser(client, 'ana@example.com');
    const bia = await insertUser(client, 'bia@example.com');
    const household = (await client.query<{ id: string }>(
      "INSERT INTO households (name) VALUES ('Home') RETURNING id",
    )).rows[0]!.id;
    const category = (await client.query<{ id: string }>(
      `INSERT INTO categories (household_id, name, icon, color)
       VALUES ($1, 'Food', 'cart', 'mint') RETURNING id`,
      [household],
    )).rows[0]!.id;
    const claim = async (owner: string, visibility: string) => {
      const budget = (await client.query<{ id: string }>(
        `INSERT INTO budgets
           (household_id, owner_user_id, name, target_amount, currency, visibility)
         VALUES ($1, $2, 'B', 1000, 'BRL', $3) RETURNING id`,
        [household, owner, visibility],
      )).rows[0]!.id;
      return errorCodeOf(
        client,
        `INSERT INTO budget_targets
           (budget_id, category_id, household_id, visibility, owner_user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [budget, category, household, visibility, owner],
      );
    };

    expect(await claim(ana, 'shared')).toBeUndefined();
    // Shared scope is the household: another member's shared budget can't claim it.
    expect(await claim(bia, 'shared')).toBe(UNIQUE_VIOLATION);
    // Personal scope is the owner: each member can claim it once.
    expect(await claim(ana, 'personal')).toBeUndefined();
    expect(await claim(bia, 'personal')).toBeUndefined();
    expect(await claim(bia, 'personal')).toBe(UNIQUE_VIOLATION);
  });
});
