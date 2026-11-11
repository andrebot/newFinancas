import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Runs the investmentsDaily trigger directly, as an operator would
// (`pnpm investments:run`, N9), against the test database (I6, OQ-237).

/**
 * Runs `pnpm investments:run` once as of a fixed app day.
 *
 * The API under test runs the same job on its own timer; journeys pick a day
 * years before every other journey's data, so neither run reaches the other's.
 *
 * @param today - The app day to run as of, `YYYY-MM-DD`, on or before today.
 * @returns Resolves when the command exits 0; rejects with its output otherwise.
 */
const runInvestmentsDaily = async (today: string): Promise<void> => {
  await promisify(execFile)(
    'pnpm',
    ['--filter', '@financas/api', 'investments:run', `--today=${today}`],
    { env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL ?? '' } },
  );
};

export default runInvestmentsDaily;
