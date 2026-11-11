import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Runs the investmentsDaily trigger directly, as an operator would
// (`pnpm investments:run`, N9), against the test database (I6, OQ-237).

/**
 * Runs `pnpm investments:run` once as of a fixed app day.
 *
 * The API under test runs with its daily timer off (playwright.config.ts), and
 * journeys date their data years before every other journey's, so a run reaches
 * only its own journey's Holdings. A run that found the lock busy also exits 0:
 * it must have logged its completion as of `today`, or nothing ran.
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

export default runInvestmentsDaily;
