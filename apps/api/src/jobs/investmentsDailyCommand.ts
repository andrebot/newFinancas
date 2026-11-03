import type { Logger } from '@financas/logging';
import { calendar } from '../config/constants';
import calendarDate from '../utilities/calendar';
import { newCorrelationId } from '../utilities/correlationId';
import type { InvestmentsDailyResult, InvestmentsDailyRun } from './investmentsDaily';

/**
 * Reports dispatch and confirmation separately, without claiming a publish is delivery.
 *
 * @param result - Counts, or undefined when another process owns the run.
 * @param log - The process logging sink.
 * @returns Nothing.
 */
export const reportInvestmentsDaily = (
  result: InvestmentsDailyResult | undefined,
  log: Pick<Logger, 'info' | 'warn'>,
): void => {
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

/** The command's immediate runtime and logging boundary. */
export interface InvestmentsDailyCommandDeps {
  readonly run: InvestmentsDailyRun;
  readonly now: () => Date;
  readonly close: () => Promise<void>;
  readonly onCompleted: (result: InvestmentsDailyResult | undefined) => void;
  readonly onError: (error: unknown) => void;
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
  try {
    const today = calendarDate(deps.now(), calendar.timeZone);
    const result = await deps.run(today, newCorrelationId());
    deps.onCompleted(result);
    if (result && result.deferredHoldings + result.deferredNotices > 0) exitCode = 1;
  } catch (error) {
    deps.onError(error);
    exitCode = 1;
  }
  try {
    await deps.close();
  } catch (error) {
    deps.onError(error);
    exitCode = 1;
  }
  return exitCode;
};
