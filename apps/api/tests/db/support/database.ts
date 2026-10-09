import path from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { sql, TransactionRollbackError } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from '../../../src/db/database';

const MIGRATIONS = path.resolve(import.meta.dirname, '../../../drizzle');

/** A transaction-scoped connection, as handed to `asAppRole` callbacks. */
export type AppRoleConnection = Transaction;

/**
 * Creates an in-memory Postgres 18 (PGlite) with every real migration applied —
 * the same SQL the owner role runs against the real database. The application
 * role is created first, as `infra/db/init/` does, so the grants migration applies.
 *
 * @returns The migrated database; close it after the tests.
 */
export const createMigratedDatabase = async (): Promise<PGlite> => {
  const pglite = new PGlite();
  await pglite.exec('CREATE ROLE financas_app LOGIN');
  await migrate(drizzle(pglite), { migrationsFolder: MIGRATIONS });
  return pglite;
};

/**
 * Runs `work` as the application role inside a transaction that is always rolled
 * back, so each check sees the freshly migrated database.
 *
 * @param pglite - A migrated database.
 * @param work - Queries to run as `financas_app`.
 * @returns Whatever `work` returns.
 */
export const asAppRole = async <T>(
  pglite: PGlite,
  work: (connection: AppRoleConnection) => Promise<T>,
): Promise<T> => pglite.transaction(async (tx) => {
  await tx.exec('SET LOCAL ROLE financas_app');
  const result = await work(tx);
  await tx.rollback();
  return result;
});

/**
 * Runs one statement inside a savepoint: keeps its effect when it succeeds,
 * undoes it and reports the Postgres error code when it fails.
 *
 * @param connection - A connection inside a transaction.
 * @param statement - SQL to run.
 * @param values - Statement parameters.
 * @returns The SQLSTATE code, or `undefined` if the statement succeeded.
 */
export const errorCodeOf = async (
  connection: AppRoleConnection,
  statement: string,
  values: unknown[] = [],
): Promise<string | undefined> => {
  await connection.exec('SAVEPOINT attempt');
  try {
    await connection.query(statement, values);
    await connection.exec('RELEASE SAVEPOINT attempt');
    return undefined;
  } catch (error) {
    await connection.exec('ROLLBACK TO SAVEPOINT attempt');
    return (error as { code?: string }).code;
  }
};

/**
 * Inserts one row and returns its generated id.
 *
 * @param connection - A connection inside a transaction.
 * @param statement - An `INSERT … RETURNING id`.
 * @param values - Statement parameters.
 * @returns The new row's id.
 */
export const insertId = async (
  connection: AppRoleConnection,
  statement: string,
  values: unknown[] = [],
): Promise<string> => {
  const { rows } = await connection.query<{ id: string }>(statement, values);
  return rows[0]!.id;
};

/**
 * Inserts a user with placeholder credentials.
 *
 * @param connection - A connection inside a transaction.
 * @param email - Unique email.
 * @returns The new user's id.
 */
export const insertUser = (
  connection: AppRoleConnection,
  email: string,
): Promise<string> => insertId(
  connection,
  `INSERT INTO users (email, password_hash, first_name, last_name, mfa_secret)
   VALUES ($1, 'x', 'Test', 'User', 'x') RETURNING id`,
  [email],
);

/**
 * Runs an Accessor test against the migrated database, as the application role,
 * inside a transaction that is always rolled back (OQ-103): tests never see each
 * other's rows, and an Accessor's own transactions become savepoints.
 *
 * @param pglite - A migrated database.
 * @param work - The test, given a Drizzle database to build the Accessor with.
 * @returns Resolves once the test ran and its writes were undone.
 */
export const withRollback = async (
  pglite: PGlite,
  work: (db: Database) => Promise<void>,
): Promise<void> => {
  try {
    await drizzle(pglite).transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE financas_app`);
      await work(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
};
