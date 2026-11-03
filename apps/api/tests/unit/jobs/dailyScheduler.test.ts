import { captureLogs } from '@financas/logging';
import {
  afterEach, beforeEach, describe, expect, it, onTestFinished, vi,
} from 'vitest';
import { reportInvestmentsDaily, reportInvestmentsDailyFailure }
  from '../../../src/jobs/investmentsDailyCommand';
import { investmentsDaily } from '../../../src/config/constants';
import { startDailyScheduler } from '../../../src/jobs/dailyScheduler';
import type { InvestmentsDailyRun } from '../../../src/jobs/investmentsDaily';

const RESULT = {
  cashEvents: 0, maturedHoldings: 0, deferredHoldings: 0, deferredNotices: 0,
};

/**
 * Builds only the timer's job and external logging boundary.
 *
 * @returns Dependency spies and the scheduler's stop function.
 */
const setup = () => {
  const deps = {
    run: vi.fn<InvestmentsDailyRun>().mockResolvedValue(RESULT),
    now: () => new Date(),
    onCompleted: vi.fn(),
    onError: vi.fn(),
  };
  return { deps, start: () => startDailyScheduler(deps) };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-03T02:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('local daily scheduler', () => {
  it('emits failure and retry completion with each attempt ID and the original stack', async () => {
    const { events } = captureLogs(onTestFinished);
    const { deps } = setup();
    const error = new Error('database unavailable');
    deps.run.mockRejectedValueOnce(error);
    const stop = startDailyScheduler({
      ...deps, onCompleted: reportInvestmentsDaily, onError: reportInvestmentsDailyFailure,
    });
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs);
    await stop();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      message: 'investmentsDaily failed',
      level: 'error',
      actor: 'system',
      correlationId: deps.run.mock.calls[0]![1],
      stack: error.stack,
      error: String(error),
    });
    expect(events[1]).toMatchObject({
      message: 'investmentsDaily completed',
      level: 'info',
      actor: 'system',
      correlationId: deps.run.mock.calls[1]![1],
      ...RESULT,
    });
    expect(events[0]!.correlationId).not.toBe(events[1]!.correlationId);
  });

  it('catches up immediately using Sao Paulo today, then skips the same day', async () => {
    const { deps, start } = setup();
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs * 2);
    expect(deps.run).toHaveBeenCalledTimes(1);
    expect(deps.run).toHaveBeenCalledWith('2026-11-02', expect.any(String));
    expect(deps.onCompleted).toHaveBeenCalledWith(RESULT, deps.run.mock.calls[0]![1]);
    expect(deps.onError).not.toHaveBeenCalled();
    await stop();
  });

  it('uses calendar-day rollover rather than elapsed 24 hours or UTC midnight', async () => {
    vi.setSystemTime(new Date('2026-11-03T02:59:30Z'));
    const { deps, start } = setup();
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs);
    expect(deps.run.mock.calls.map(([date]) => date)).toEqual(['2026-11-02', '2026-11-03']);
    expect(deps.run.mock.calls[0]![1]).not.toBe(deps.run.mock.calls[1]![1]);
    await stop();
  });

  it('does not run again at UTC midnight when the app day has not changed', async () => {
    vi.setSystemTime(new Date('2026-11-03T23:59:30Z'));
    const { deps, start } = setup();
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs);
    expect(deps.run).toHaveBeenCalledTimes(1);
    await stop();
  });

  it('retries a busy lock on the next tick', async () => {
    const { deps, start } = setup();
    deps.run.mockResolvedValueOnce(undefined);
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs * 2);
    expect(deps.run).toHaveBeenCalledTimes(2);
    expect(deps.onCompleted.mock.calls).toEqual([
      [undefined, deps.run.mock.calls[0]![1]], [RESULT, deps.run.mock.calls[1]![1]],
    ]);
    await stop();
  });

  it('consumes a failed run, retries next tick and preserves the captured date', async () => {
    const { deps, start } = setup();
    const error = new Error('database unavailable');
    deps.run.mockRejectedValueOnce(error);
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs * 2);
    expect(deps.run).toHaveBeenCalledTimes(2);
    expect(deps.onError).toHaveBeenCalledExactlyOnceWith(error, deps.run.mock.calls[0]![1]);
    await stop();
  });

  it('does not spin-retry a completed run with deferred deliveries', async () => {
    const { deps, start } = setup();
    deps.run.mockResolvedValueOnce({ ...RESULT, deferredHoldings: 1 });
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs * 2);
    expect(deps.run).toHaveBeenCalledTimes(1);
    await stop();
  });

  it('never overlaps; stop waits and clears the timer idempotently', async () => {
    const { deps, start } = setup();
    let finish!: (result: typeof RESULT) => void;
    deps.run.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve;
    }));
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs * 2);
    expect(deps.run).toHaveBeenCalledTimes(1);
    const stopped = vi.fn();
    const closing = stop().then(stopped);
    await Promise.resolve();
    expect(stopped).not.toHaveBeenCalled();
    finish(RESULT);
    await closing;
    await stop();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs * 2);
    expect(deps.run).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('assigns the start day, not the finish day, to a long-running attempt', async () => {
    vi.setSystemTime(new Date('2026-11-03T02:59:30Z'));
    const { deps, start } = setup();
    let finish!: (result: typeof RESULT) => void;
    deps.run.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve;
    }));
    const stop = start();
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs);
    finish(RESULT);
    await vi.advanceTimersByTimeAsync(investmentsDaily.pollIntervalMs);
    expect(deps.run.mock.calls.map(([date]) => date)).toEqual(['2026-11-02', '2026-11-03']);
    await stop();
  });
});
