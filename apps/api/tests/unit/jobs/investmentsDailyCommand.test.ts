import {
  describe, expect, it, vi,
} from 'vitest';
import {
  reportInvestmentsDaily, runInvestmentsDailyCommand,
} from '../../../src/jobs/investmentsDailyCommand';
import type { InvestmentsDailyRun } from '../../../src/jobs/investmentsDaily';

const RESULT = {
  cashEvents: 3, maturedHoldings: 1, deferredHoldings: 0, deferredNotices: 0,
};

/**
 * Builds the command's direct job, cleanup and log boundary.
 *
 * @returns Command dependency spies.
 */
const setup = () => ({
  run: vi.fn<InvestmentsDailyRun>().mockResolvedValue(RESULT),
  now: () => new Date('2026-11-03T02:00:00Z'),
  close: vi.fn().mockResolvedValue(undefined),
  onCompleted: vi.fn(),
  onError: vi.fn(),
});

describe('investments:run command lifecycle', () => {
  it('runs once in the app time zone and closes resources after logging', async () => {
    const deps = setup();
    expect(await runInvestmentsDailyCommand(deps)).toBe(0);
    expect(deps.run).toHaveBeenCalledExactlyOnceWith('2026-11-02', expect.any(String));
    expect(deps.onCompleted).toHaveBeenCalledExactlyOnceWith(RESULT);
    expect(deps.close).toHaveBeenCalledTimes(1);
    expect(deps.onCompleted.mock.invocationCallOrder[0])
      .toBeLessThan(deps.close.mock.invocationCallOrder[0]!);
    expect(deps.onError).not.toHaveBeenCalled();
  });

  it('reports busy without pretending anything was dispatched', async () => {
    const deps = setup();
    deps.run.mockResolvedValueOnce(undefined);
    expect(await runInvestmentsDailyCommand(deps)).toBe(0);
    expect(deps.onCompleted).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(deps.close).toHaveBeenCalledTimes(1);
  });

  it.each(['deferredHoldings', 'deferredNotices'] as const)(
    'exits nonzero for %s, retaining the published counts',
    async (field) => {
      const deps = setup();
      const result = { ...RESULT, [field]: 1 };
      deps.run.mockResolvedValueOnce(result);
      expect(await runInvestmentsDailyCommand(deps)).toBe(1);
      expect(deps.onCompleted).toHaveBeenCalledExactlyOnceWith(result);
      expect(deps.close).toHaveBeenCalledTimes(1);
    },
  );

  it('reports a failed run and still closes', async () => {
    const deps = setup();
    const error = new Error('database failed');
    deps.run.mockRejectedValueOnce(error);
    expect(await runInvestmentsDailyCommand(deps)).toBe(1);
    expect(deps.onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(deps.onCompleted).not.toHaveBeenCalled();
    expect(deps.close).toHaveBeenCalledTimes(1);
  });

  it('reports cleanup failure with a nonzero exit', async () => {
    const deps = setup();
    const error = new Error('pool close failed');
    deps.close.mockRejectedValueOnce(error);
    expect(await runInvestmentsDailyCommand(deps)).toBe(1);
    expect(deps.onError).toHaveBeenCalledExactlyOnceWith(error);
  });
});

describe('daily run reporting', () => {
  it.each([
    [undefined, 'info', 'investmentsDaily skipped: another run owns the lock'],
    [RESULT, 'info', 'investmentsDaily completed'],
    [{ ...RESULT, deferredHoldings: 1 }, 'warn',
      'investmentsDaily completed with deferred deliveries'],
    [{ ...RESULT, deferredNotices: 1 }, 'warn',
      'investmentsDaily completed with deferred deliveries'],
  ] as const)('reports %j honestly', (result, level, message) => {
    const sink = { info: vi.fn(), warn: vi.fn() };
    reportInvestmentsDaily(result, sink);
    expect(sink[level].mock.calls).toEqual([result ? [message, result] : [message]]);
    expect(sink[level === 'info' ? 'warn' : 'info']).not.toHaveBeenCalled();
  });
});
