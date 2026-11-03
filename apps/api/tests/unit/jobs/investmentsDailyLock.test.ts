import {
  describe, expect, it, vi,
} from 'vitest';
import { investmentsDaily } from '../../../src/config/constants';
import { createInvestmentsDailyLock } from '../../../src/jobs/investmentsDailyLock';

/**
 * Builds a lock over only its PostgreSQL driver boundary.
 *
 * @param acquired - PostgreSQL's non-blocking acquisition answer.
 * @returns Driver spies and the lock runner.
 */
const setup = (acquired = true) => {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [{ acquired }] }), release: vi.fn(),
  };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  const run = createInvestmentsDailyLock(pool);
  return { client, pool, run };
};

describe('investmentsDaily PostgreSQL session exclusion', () => {
  it('pins the acquired connection until work finishes, then unlocks and releases', async () => {
    const { client, run } = setup();
    const work = vi.fn(async () => {
      expect(client.release).not.toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledTimes(1);
      return 42;
    });
    expect(await run(work)).toBe(42);
    expect(client.query.mock.calls).toEqual([
      ['SELECT pg_try_advisory_lock($1) AS acquired', [investmentsDaily.lockKey]],
      ['SELECT pg_advisory_unlock($1)', [investmentsDaily.lockKey]],
    ]);
    expect(client.release).toHaveBeenCalledExactlyOnceWith();
  });

  it('skips without blocking or unlocking the other session lock', async () => {
    const { client, run } = setup(false);
    const work = vi.fn();
    expect(await run(work)).toBeUndefined();
    expect(work).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('unlocks and releases when the work throws', async () => {
    const { client, run } = setup();
    const error = new Error('read failed');
    await expect(run(() => Promise.reject(error))).rejects.toBe(error);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledExactlyOnceWith();
  });

  it('destroys an uncertain session when acquisition throws', async () => {
    const { client, run } = setup();
    const error = new Error('lost acquisition response');
    client.query.mockRejectedValueOnce(error);
    await expect(run(vi.fn())).rejects.toBe(error);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('destroys the session rather than returning a held lock when unlock fails', async () => {
    const { client, run } = setup();
    const error = new Error('unlock failed');
    client.query.mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockRejectedValueOnce(error);
    await expect(run(async () => 42)).rejects.toBe(error);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('propagates a connection failure without pretending to have a client', async () => {
    const { pool, run } = setup();
    const error = new Error('connect failed');
    pool.connect.mockRejectedValueOnce(error);
    await expect(run(vi.fn())).rejects.toBe(error);
  });
});
