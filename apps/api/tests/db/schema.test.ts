import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import {
  asAppRole, createMigratedDatabase, errorCodeOf, insertId, insertUser, type AppRoleConnection,
} from './support/database';

// Schema checks (OQ-95): the real migrations, applied to an embedded Postgres 18
// (PGlite), seen from the application role the API connects as.

const PERMISSION_DENIED = '42501';
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

let database: PGlite;

beforeAll(async () => {
  database = await createMigratedDatabase();
});

afterAll(async () => {
  await database.close();
});

/**
 * Inserts a household.
 *
 * @param connection - A connection inside a transaction.
 * @returns The household id.
 */
const insertHousehold = (connection: AppRoleConnection) => insertId(
  connection,
  "INSERT INTO households (name) VALUES ('Home') RETURNING id",
);

describe('migrated schema', () => {
  it('has the 26 v1 tables, with uuidv7 primary keys', async () => {
    await asAppRole(database, async (connection) => {
      const { rows } = await connection.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM information_schema.tables
         WHERE table_schema = 'public'`,
      );

      expect(rows[0]!.count).toBe(26);
      expect(await insertUser(connection, 'uuid@example.com'))
        .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    });
  });

  it('allows only one Owner per household', async () => {
    await asAppRole(database, async (connection) => {
      const household = await insertHousehold(connection);
      const owner = await insertUser(connection, 'owner@example.com');
      const other = await insertUser(connection, 'other@example.com');
      const insertMember = `INSERT INTO household_memberships (household_id, user_id, role)
                            VALUES ($1, $2, $3)`;
      await connection.query(insertMember, [household, owner, 'Owner']);

      expect(await errorCodeOf(connection, insertMember, [household, other, 'Owner']))
        .toBe(UNIQUE_VIOLATION);
      expect(await errorCodeOf(connection, insertMember, [household, other, 'Admin']))
        .toBeUndefined();
    });
  });

  it('lets a category be claimed once per budget scope (FR-4.7)', async () => {
    await asAppRole(database, async (connection) => {
      const household = await insertHousehold(connection);
      const ana = await insertUser(connection, 'ana@example.com');
      const bia = await insertUser(connection, 'bia@example.com');
      const category = await insertId(
        connection,
        `INSERT INTO categories (household_id, name, icon, color)
         VALUES ($1, 'Food', 'cart', 'mint') RETURNING id`,
        [household],
      );
      const claim = async (owner: string, visibility: string) => {
        const budget = await insertId(
          connection,
          `INSERT INTO budgets
             (household_id, owner_user_id, name, target_amount, currency, visibility)
           VALUES ($1, $2, 'B', 1000, 'BRL', $3) RETURNING id`,
          [household, owner, visibility],
        );
        return errorCodeOf(
          connection,
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

  it('keeps the audit log append-only for the application role (NFR-AUD-1)', async () => {
    await asAppRole(database, async (connection) => {
      const insert = `INSERT INTO audit_log_entries (action, entity_type, entity_id)
                      VALUES ('test', 'test', uuidv7())`;

      expect(await errorCodeOf(connection, insert)).toBeUndefined();
      expect(await errorCodeOf(connection, "UPDATE audit_log_entries SET action = 'x'"))
        .toBe(PERMISSION_DENIED);
      expect(await errorCodeOf(connection, 'DELETE FROM audit_log_entries'))
        .toBe(PERMISSION_DENIED);
    });
  });

  it('stores transaction amounts as positive numbers only (OQ-98)', async () => {
    await asAppRole(database, async (connection) => {
      const household = await insertHousehold(connection);
      const account = await insertId(
        connection,
        `INSERT INTO accounts (household_id, name, type, currency, visibility)
         VALUES ($1, 'A', 'checking', 'BRL', 'shared') RETURNING id`,
        [household],
      );
      const insert = `INSERT INTO account_transactions
                        (account_id, kind, effect, date, amount, currency)
                      VALUES ($1, 'pix_payment', 'movement', '2026-10-08', $2, 'BRL')`;

      expect(await errorCodeOf(connection, insert, [account, 8540])).toBeUndefined();
      expect(await errorCodeOf(connection, insert, [account, -8540])).toBe(CHECK_VIOLATION);
      expect(await errorCodeOf(connection, insert, [account, 0])).toBe(CHECK_VIOLATION);
    });
  });

  it('does not let the application role change the schema', async () => {
    await asAppRole(database, async (connection) => {
      expect(await errorCodeOf(connection, 'CREATE TABLE probe (x int)')).toBe(PERMISSION_DENIED);
      expect(await errorCodeOf(connection, 'DROP TABLE users')).not.toBeUndefined();
    });
  });
});
