import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
  it('has the 27 v1 tables, with uuidv7 primary keys', async () => {
    await asAppRole(database, async (connection) => {
      const { rows } = await connection.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM information_schema.tables
         WHERE table_schema = 'public'`,
      );

      expect(rows[0]!.count).toBe(27);
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
        `INSERT INTO accounts
           (household_id, name, type, currency, visibility, starting_balance_date)
         VALUES ($1, 'A', 'checking', 'BRL', 'shared', '2026-01-01') RETURNING id`,
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

  it('keeps a pair one sent and one received side, only it a `transfer` (OQ-222)', async () => {
    await asAppRole(database, async (connection) => {
      const household = await insertHousehold(connection);
      const account = await insertId(
        connection,
        `INSERT INTO accounts
           (household_id, name, type, currency, visibility, starting_balance_date)
         VALUES ($1, 'A', 'checking', 'BRL', 'shared', '2026-01-01') RETURNING id`,
        [household],
      );
      const pair = '0199c5a0-0000-7000-8000-0000000000aa';
      const side = `INSERT INTO account_transactions
                      (account_id, kind, effect, date, amount, currency, transfer_id)
                    VALUES ($1, $2, $3, '2026-10-08', 100, 'BRL', $4)`;

      expect(await errorCodeOf(connection, side, [account, 'transfer_sent', 'transfer', pair]))
        .toBeUndefined();
      expect(await errorCodeOf(connection, side, [account, 'transfer_received', 'transfer', pair]))
        .toBeUndefined();
      expect(await errorCodeOf(connection, side, [account, 'transfer_sent', 'transfer', pair]))
        .toBe(UNIQUE_VIOLATION);
      expect(await errorCodeOf(connection, side, [account, 'transfer_sent', 'transfer', null]))
        .toBe(CHECK_VIOLATION);
      expect(await errorCodeOf(connection, side, [account, 'transfer_sent', 'movement', pair]))
        .toBe(CHECK_VIOLATION);
      expect(await errorCodeOf(connection, side, [account, 'transfer_sent', 'movement', null]))
        .toBeUndefined();
    });
  });

  it('keeps a fixed-term Holding\'s contract terms on it (OQ-224)', async () => {
    await asAppRole(database, async (connection) => {
      const household = await insertHousehold(connection);
      const account = await insertId(
        connection,
        `INSERT INTO accounts
           (household_id, name, type, currency, visibility, starting_balance_date)
         VALUES ($1, 'A', 'investment', 'BRL', 'shared', '2026-01-01') RETURNING id`,
        [household],
      );
      const holding = `INSERT INTO investment_holdings (account_id, asset_type, quantity,
                         cost_basis, rate_type, rate_value, interest_payment, due_date)
                       VALUES ($1, $2, 0, 0, $3, $4, $5, $6)`;
      const terms = ['cdi', 1_100_000, 'at_maturity', '2027-10-15'];
      const none = [null, null, null, null];

      expect(await errorCodeOf(connection, holding, [account, 'cdb', ...terms])).toBeUndefined();
      expect(await errorCodeOf(connection, holding, [account, 'treasury', ...none]))
        .toBe(CHECK_VIOLATION);
      expect(await errorCodeOf(connection, holding, [account, 'stock', ...none])).toBeUndefined();
    });
  });

  it('restates trade values as the money moves them (migration 0015, OQ-222)', async () => {
    await asAppRole(database, async (connection) => {
      const household = await insertHousehold(connection);
      const account = await insertId(
        connection,
        `INSERT INTO accounts
           (household_id, name, type, currency, visibility, starting_balance_date)
         VALUES ($1, 'A', 'investment', 'BRL', 'shared', '2026-01-01') RETURNING id`,
        [household],
      );
      const holding = await insertId(
        connection,
        `INSERT INTO investment_holdings (account_id, asset_type, ticker, quantity, cost_basis)
         VALUES ($1, 'stock', 'PETR4', 0, 0) RETURNING id`,
        [account],
      );
      /** Records a trade with its old, unit-price snapshot. */
      const trade = async (kind: string, date: string, amount: number, units: number) => {
        const id = await insertId(
          connection,
          `INSERT INTO account_transactions (account_id, kind, effect, date, amount, currency,
             holding_id, quantity_delta, cost_basis_delta)
           VALUES ($1, $2, 'investment_trade', $3, $4, 'BRL', $5, $6, 0) RETURNING id`,
          [account, kind, date, amount, holding, units],
        );
        await connection.query(
          `INSERT INTO valuation_snapshots (holding_id, valuation, as_of_date, source,
             account_transaction_id) VALUES ($1, 0, $2, 'transaction', $3)`,
          [holding, date, id],
        );
        return id;
      };
      const first = await trade('investment_buy', '2026-10-01', 60_000, 2_000_000_000);
      const second = await trade('investment_buy', '2026-10-02', 30_000, 1_000_000_000);
      await connection.query(
        `INSERT INTO valuation_snapshots (holding_id, valuation, as_of_date, source)
         VALUES ($1, 100000, '2026-10-03', 'manual')`,
        [holding],
      );
      const sold = await trade('investment_sell', '2026-10-04', 40_000, -1_000_000_000);
      const out = await trade('investment_sell', '2026-10-05', 1_000, -2_000_000_000);

      const name = '0015_transfer_pairs_and_trade_values.sql';
      const file = new URL(`../../drizzle/${name}`, import.meta.url);
      const migration = await readFile(fileURLToPath(file), 'utf8');
      await connection.query(migration.split('--> statement-breakpoint').at(-1)!);

      const { rows } = await connection.query<{ id: string; valuation: number }>(
        'SELECT account_transaction_id AS id, valuation FROM valuation_snapshots WHERE source = $1',
        ['transaction'],
      );
      const values = Object.fromEntries(rows.map((row) => [row.id, Number(row.valuation)]));
      expect(values).toEqual({
        [first]: 60_000, [second]: 90_000, [sold]: 60_000, [out]: 0,
      });
    });
  });

  it('makes every user a USER unless set, and knows only USER and ADMIN (OQ-111)', async () => {
    await asAppRole(database, async (connection) => {
      const user = await insertUser(connection, 'role@example.com');
      const { rows } = await connection.query<{ system_role: string }>(
        'SELECT system_role FROM users WHERE id = $1',
        [user],
      );
      const setRole = 'UPDATE users SET system_role = $2 WHERE id = $1';

      expect(rows[0]!.system_role).toBe('USER');
      expect(await errorCodeOf(connection, setRole, [user, 'ADMIN'])).toBeUndefined();
      expect(await errorCodeOf(connection, setRole, [user, 'Admin'])).toBe(CHECK_VIOLATION);
    });
  });

  it('does not let the application role change the schema', async () => {
    await asAppRole(database, async (connection) => {
      expect(await errorCodeOf(connection, 'CREATE TABLE probe (x int)')).toBe(PERMISSION_DENIED);
      expect(await errorCodeOf(connection, 'DROP TABLE users')).not.toBeUndefined();
    });
  });
});
