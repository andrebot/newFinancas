import type { Pool, PoolClient } from 'pg';
import { investmentsDaily } from '../config/constants';

/** Exclusive execution; work stops dispatch at checkpoints when the session is lost. */
export type JobLock = <Result>(
  work: (signal: AbortSignal) => Promise<Result>,
) => Promise<Result | undefined>;

/**
 * Unlocks before returning the pinned connection; uncertain locks destroy it.
 *
 * @param client - The dedicated driver connection.
 * @param acquired - Whether the session acquired the lock.
 * @param discard - Whether acquisition or ownership is already uncertain.
 * @param signal - Session loss may also happen while the unlock query is pending.
 * @returns Resolves once the connection is released.
 */
const releaseLock = async (
  client: PoolClient,
  acquired: boolean,
  discard: boolean,
  signal: AbortSignal,
) => {
  if (!acquired || discard) {
    client.release(discard);
    return;
  }
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [investmentsDaily.lockKey]);
  } catch (error) {
    client.release(true);
    throw error;
  }
  client.release(signal.aborted);
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
  const controller = new AbortController();
  /**
   * Contains the driver's out-of-band error and revokes further dispatch.
   *
   * @param error - The checked-out session's connection failure.
   * @returns Nothing; the run reports it after active work has settled.
   */
  const onConnectionError = (error: Error): void => controller.abort(error);
  client.on('error', onConnectionError);
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
    controller.signal.throwIfAborted();
    return await work(controller.signal);
  } finally {
    try {
      await releaseLock(
        client,
        acquired,
        uncertain || controller.signal.aborted,
        controller.signal,
      );
    } finally {
      client.removeListener('error', onConnectionError);
      controller.signal.throwIfAborted();
    }
  }
};
