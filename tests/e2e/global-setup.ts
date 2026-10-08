import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';

const RESET = `DROP SCHEMA IF EXISTS drizzle CASCADE;
               DROP SCHEMA public CASCADE;
               CREATE SCHEMA public;`;

/**
 * Playwright global setup: gives every E2E run a fresh test database — drops
 * everything, then applies all migrations as the owner role, exactly as a new
 * environment would.
 *
 * @returns Resolves once the test database is migrated.
 */
const globalSetup = async (): Promise<void> => {
  const migrationUrl = process.env.DATABASE_TEST_MIGRATION_URL;
  if (!migrationUrl) throw new Error('DATABASE_TEST_MIGRATION_URL is not set (see .env.example)');

  const client = new pg.Client({ connectionString: migrationUrl });
  await client.connect();
  await client.query(RESET);
  await client.end();

  await promisify(execFile)('pnpm', ['--filter', '@financas/api', 'db:migrate'], {
    env: { ...process.env, DATABASE_MIGRATION_URL: migrationUrl },
  });
};

export default globalSetup;
