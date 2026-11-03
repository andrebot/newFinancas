import { EventEmitter } from 'node:events';
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
  const client = Object.assign(new EventEmitter(), {
    query: vi.fn().mockResolvedValue({ rows: [{ acquired }] }), release: vi.fn(),
  });
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  const run = createInvestmentsDailyLock(pool);
  return { client, pool, run };
};

describe('investmentsDaily PostgreSQL session exclusion', () => {
  it('contains client errors, settles active work and discards the session', async () => {
    const { client, run } = setup();
    const error = new Error('lock socket lost');
    let started!: () => void;
    let finish!: () => void;
    const active = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const settled = vi.fn();
    const running = run(async () => {
      started();
      await pending;
    }).then(() => 'completed', (failure: unknown) => failure).finally(settled);
    await active;
    let escaped: unknown;
    try {
      client.emit('error', error);
      client.emit('error', new Error('second connection error'));
    } catch (failure) {
      escaped = failure;
    }
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    finish();
    const outcome = await running;
    expect(escaped).toBeUndefined();
    expect(outcome).toBe(error);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

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
    expect(client.release).toHaveBeenCalledExactlyOnceWith(false);
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
    expect(client.release).toHaveBeenCalledExactlyOnceWith(false);
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

  it('does not start work after a connection error during acquisition', async () => {
    const { client, run } = setup();
    const error = new Error('session lost during acquisition');
    client.query.mockImplementationOnce(async () => {
      client.emit('error', error);
      return { rows: [{ acquired: true }] };
    });
    const work = vi.fn();
    await expect(run(work)).rejects.toBe(error);
    expect(work).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('discards a lost session even if its unlock query resolves', async () => {
    const { client, run } = setup();
    const error = new Error('session lost during unlock');
    client.query.mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockImplementationOnce(async () => {
        client.emit('error', error);
        return { rows: [] };
      });
    await expect(run(async () => 42)).rejects.toBe(error);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('removes only its own listener after healthy release', async () => {
    const { client, run } = setup();
    const otherListener = vi.fn();
    client.on('error', otherListener);
    await run(async (signal) => {
      expect(signal.aborted).toBe(false);
      expect(client.listenerCount('error')).toBe(2);
    });
    expect(client.listeners('error')).toEqual([otherListener]);
  });

  it('propagates a connection failure without pretending to have a client', async () => {
    const { pool, run } = setup();
    const error = new Error('connect failed');
    pool.connect.mockRejectedValueOnce(error);
    await expect(run(vi.fn())).rejects.toBe(error);
  });
});
