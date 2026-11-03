import { createLogger } from '@financas/logging';
import { calendar } from '../config/constants';
import calendarDate from '../utilities/calendar';
import { newCorrelationId, type CorrelationId } from '../utilities/correlationId';
import { failureDetails } from '../utilities/domainError';
import type { InvestmentsDailyResult, InvestmentsDailyRun } from './investmentsDaily';

/**
 * Reports dispatch and confirmation separately, without claiming a publish is delivery.
 *
 * @param result - Counts, or undefined when another process owns the run.
 * @param correlationId - The invocation shared with the job and its subscribers.
 * @returns Nothing.
 */
export const reportInvestmentsDaily = (
  result: InvestmentsDailyResult | undefined,
  correlationId: CorrelationId,
): void => {
  const log = createLogger({ label: 'investmentsDaily', correlationId, actor: 'system' });
  if (result === undefined) {
    log.info('investmentsDaily skipped: another run owns the lock');
    return;
  }
  if (result.deferredHoldings + result.deferredNotices > 0) {
    log.warn('investmentsDaily completed with deferred deliveries', { ...result });
    return;
  }
  log.info('investmentsDaily completed', { ...result });
};

/**
 * Logs a job failure without losing its throw site, domain details or run context.
 *
 * @param error - The original thrown value, including cleanup failures.
 * @param correlationId - The same invocation ID passed into the job.
 * @returns Nothing.
 */
export const reportInvestmentsDailyFailure = (
  error: unknown,
  correlationId: CorrelationId,
): void => {
  const details = failureDetails(error);
  if (error instanceof Error) details.stack = error.stack;
  createLogger({ label: 'investmentsDaily', correlationId, actor: 'system' })
    .error('investmentsDaily failed', details);
};

/** The command's immediate runtime and logging boundary. */
export interface InvestmentsDailyCommandDeps {
  readonly run: InvestmentsDailyRun;
  readonly now: () => Date;
  readonly close: () => Promise<void>;
  readonly onCompleted: (
    result: InvestmentsDailyResult | undefined, correlationId: CorrelationId,
  ) => void;
  readonly onError: (error: unknown, correlationId: CorrelationId) => void;
}

/**
 * Runs the same trigger once without opening HTTP or leaving a timer behind.
 *
 * @param deps - Job, clock, resource cleanup and logging callbacks.
 * @returns Zero on completion/busy, one on failed or unconfirmed work or cleanup.
 */
export const runInvestmentsDailyCommand = async (
  deps: InvestmentsDailyCommandDeps,
): Promise<number> => {
  let exitCode = 0;
  const correlationId = newCorrelationId();
  try {
    const today = calendarDate(deps.now(), calendar.timeZone);
    const result = await deps.run(today, correlationId);
    deps.onCompleted(result, correlationId);
    if (result && result.deferredHoldings + result.deferredNotices > 0) exitCode = 1;
  } catch (error) {
    deps.onError(error, correlationId);
    exitCode = 1;
  }
  try {
    await deps.close();
  } catch (error) {
    deps.onError(error, correlationId);
    exitCode = 1;
  }
  return exitCode;
};
