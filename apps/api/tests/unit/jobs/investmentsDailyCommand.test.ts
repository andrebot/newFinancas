import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished, vi,
} from 'vitest';
import { newCorrelationId } from '../../../src/utilities/correlationId';
import { createDomainError } from '../../../src/utilities/domainError';
import {
  reportInvestmentsDaily, reportInvestmentsDailyFailure, runInvestmentsDailyCommand,
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
  it.each(['run', 'close'] as const)(
    'emits the original stack and invocation ID when %s fails',
    async (stage) => {
      const { events } = captureLogs(onTestFinished);
      const error = new Error('session lost');
      const deps = setup();
      deps[stage].mockRejectedValueOnce(error);
      expect(await runInvestmentsDailyCommand({
        ...deps,
        onError: reportInvestmentsDailyFailure,
      })).toBe(1);
      const failures = events.filter((event) => event.message === 'investmentsDaily failed');
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({
        actor: 'system',
        correlationId: deps.run.mock.calls[0]![1],
        stack: error.stack,
        error: String(error),
      });
    },
  );

  it('runs once in the app time zone and closes resources after logging', async () => {
    const deps = setup();
    expect(await runInvestmentsDailyCommand(deps)).toBe(0);
    expect(deps.run).toHaveBeenCalledExactlyOnceWith('2026-11-02', expect.any(String));
    expect(deps.onCompleted).toHaveBeenCalledExactlyOnceWith(RESULT, deps.run.mock.calls[0]![1]);
    expect(deps.close).toHaveBeenCalledTimes(1);
    expect(deps.onCompleted.mock.invocationCallOrder[0])
      .toBeLessThan(deps.close.mock.invocationCallOrder[0]!);
    expect(deps.onError).not.toHaveBeenCalled();
  });

  it('reports busy without pretending anything was dispatched', async () => {
    const deps = setup();
    deps.run.mockResolvedValueOnce(undefined);
    expect(await runInvestmentsDailyCommand(deps)).toBe(0);
    expect(deps.onCompleted).toHaveBeenCalledExactlyOnceWith(undefined, deps.run.mock.calls[0]![1]);
    expect(deps.close).toHaveBeenCalledTimes(1);
  });

  it.each(['deferredHoldings', 'deferredNotices'] as const)(
    'exits nonzero for %s, retaining the published counts',
    async (field) => {
      const deps = setup();
      const result = { ...RESULT, [field]: 1 };
      deps.run.mockResolvedValueOnce(result);
      expect(await runInvestmentsDailyCommand(deps)).toBe(1);
      expect(deps.onCompleted).toHaveBeenCalledExactlyOnceWith(result, deps.run.mock.calls[0]![1]);
      expect(deps.close).toHaveBeenCalledTimes(1);
    },
  );

  it('reports a failed run and still closes', async () => {
    const deps = setup();
    const error = new Error('database failed');
    deps.run.mockRejectedValueOnce(error);
    expect(await runInvestmentsDailyCommand(deps)).toBe(1);
    expect(deps.onError).toHaveBeenCalledExactlyOnceWith(error, deps.run.mock.calls[0]![1]);
    expect(deps.onCompleted).not.toHaveBeenCalled();
    expect(deps.close).toHaveBeenCalledTimes(1);
  });

  it('reports cleanup failure with a nonzero exit', async () => {
    const deps = setup();
    const error = new Error('pool close failed');
    deps.close.mockRejectedValueOnce(error);
    expect(await runInvestmentsDailyCommand(deps)).toBe(1);
    expect(deps.onError).toHaveBeenCalledExactlyOnceWith(error, deps.run.mock.calls[0]![1]);
  });
});

describe('daily run reporting', () => {
  it('retains domain code, params and original stack under the run context', () => {
    const { events } = captureLogs(onTestFinished);
    const correlationId = newCorrelationId();
    const error = createDomainError({
      code: 'account.archived', message: 'Account archived', params: { accountId: 'account-one' },
    });
    reportInvestmentsDailyFailure(error, correlationId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      label: 'investmentsDaily',
      level: 'error',
      message: 'investmentsDaily failed',
      actor: 'system',
      correlationId,
      error: String(error),
      stack: error.stack,
      code: 'account.archived',
      params: { accountId: 'account-one' },
    });
  });

  it('reports a non-Error throw without inventing a stack', () => {
    const { events } = captureLogs(onTestFinished);
    const correlationId = newCorrelationId();
    reportInvestmentsDailyFailure('driver unavailable', correlationId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      label: 'investmentsDaily',
      level: 'error',
      message: 'investmentsDaily failed',
      actor: 'system',
      correlationId,
      error: 'driver unavailable',
    });
    expect(events[0]).not.toHaveProperty('stack');
  });

  it.each([
    [undefined, 'info', 'investmentsDaily skipped: another run owns the lock'],
    [RESULT, 'info', 'investmentsDaily completed'],
    [{ ...RESULT, deferredHoldings: 1 }, 'warn',
      'investmentsDaily completed with deferred deliveries'],
    [{ ...RESULT, deferredNotices: 1 }, 'warn',
      'investmentsDaily completed with deferred deliveries'],
  ] as const)('reports %j honestly', (result, level, message) => {
    const { events } = captureLogs(onTestFinished);
    const correlationId = newCorrelationId();
    reportInvestmentsDaily(result, correlationId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      label: 'investmentsDaily', actor: 'system', correlationId, level, message, ...result,
    });
  });
});
