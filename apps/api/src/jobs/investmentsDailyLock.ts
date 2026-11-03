import type { Pool, PoolClient } from 'pg';
import { investmentsDaily } from '../config/constants';

/** Exclusive execution for a job; undefined means another process owns it. */
export type JobLock = <Result>(work: () => Promise<Result>) => Promise<Result | undefined>;

/**
 * Unlocks before returning the pinned connection; uncertain locks destroy it.
 *
 * @param client - The dedicated driver connection.
 * @param acquired - Whether the session acquired the lock.
 * @param uncertain - Whether acquisition failed without an answer.
 * @returns Resolves once the connection is released.
 */
const releaseLock = async (client: PoolClient, acquired: boolean, uncertain: boolean) => {
  if (!acquired) {
    client.release(uncertain);
    return;
  }
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [investmentsDaily.lockKey]);
  } catch (error) {
    client.release(true);
    throw error;
  }
  client.release();
};

/**
 * Pins a PostgreSQL session lock across a whole run, including bus delivery.
 * The API and run-now process share it; closing a crashed session releases it.
 *
 * @param pool - The PostgreSQL connection pool.
 * @returns A non-blocking, exclusive job runner.
 */
export const createInvestmentsDailyLock = (
  pool: Pick<Pool, 'connect'>,
): JobLock => async (work) => {
  const client = await pool.connect();
  let acquired = false;
  let uncertain = true;
  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [investmentsDaily.lockKey],
    );
    acquired = result.rows[0]!.acquired;
    uncertain = false;
    if (!acquired) return undefined;
    return await work();
  } finally {
    await releaseLock(client, acquired, uncertain);
  }
};
