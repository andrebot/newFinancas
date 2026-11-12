import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';

// Runs the investmentsDaily trigger directly, as an operator would
// (`pnpm investments:run`, N9), against the test database (I6, OQ-237).

/**
 * The E2E suite's own advisory lock key — not the job's (`investmentsDaily.lockKey`):
 * it keeps whole journeys apart, while the job's lock keeps runs apart.
 */
const JOURNEY_LOCK_KEY = 4_200_237;

/**
 * Runs `pnpm investments:run` once as of a fixed app day.
 *
 * The API under test runs with its daily timer off (playwright.config.ts), and
 * journeys date their data years before every other journey's, so a run reaches
 * only the data of journeys that run the job. A run that found the lock busy
 * also exits 0: it must have logged its completion as of `today`, or nothing ran.
 *
 * @param today - The app day to run as of, `YYYY-MM-DD`, on or before today.
 * @returns Resolves once the command ran as of `today`; rejects with its output otherwise.
 */
const runInvestmentsDaily = async (today: string): Promise<void> => {
  const { stdout } = await promisify(execFile)(
    'pnpm',
    ['--filter', '@financas/api', 'investments:run', `--today=${today}`],
    { env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL ?? '' } },
  );
  if (!new RegExp(`investmentsDaily completed +today=${today} `).test(stdout)) {
    throw new Error(`investments:run did not run as of ${today}:\n${stdout}`);
  }
};

/**
 * Runs a journey that runs the job with no other such journey beside it (R4
 * E2): a run posts every journey's due entries and takes the job's lock, so
 * two at once — another journey, or a copy under `--repeat-each` — would see
 * each other's data and find the lock busy. Waits on a session advisory lock
 * in the test database, released when the journey ends or its process dies.
 *
 * @param journey - The journey, from arranging its data to its last check.
 * @returns What the journey returns, once it has run alone.
 */
export const aloneWithTheJob = async <Result>(journey: () => Promise<Result>): Promise<Result> => {
  const connectionString = process.env.DATABASE_TEST_URL;
  if (!connectionString) throw new Error('DATABASE_TEST_URL is not set (see .env.example)');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [JOURNEY_LOCK_KEY]);
    return await journey();
  } finally {
    await client.end();
  }
};

export default runInvestmentsDaily;
