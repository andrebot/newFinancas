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

/** The option that runs the job as of an earlier app day, e.g. `--today=2020-07-02`. */
const TODAY_OPTION = '--today=';

/**
 * Reads the command's `--today=YYYY-MM-DD` option, unchecked (OQ-237).
 *
 * @param argv - The process arguments.
 * @returns The option's value, or undefined when it isn't given.
 */
export const todayOption = (argv: readonly string[]): string | undefined => (
  argv.find((argument) => argument.startsWith(TODAY_OPTION))?.slice(TODAY_OPTION.length)
);

/**
 * Whether a text is a real `YYYY-MM-DD` calendar day (not `2020-02-30`).
 *
 * @param text - The text.
 * @returns True for a real day.
 */
const isCalendarDay = (text: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const instant = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(instant.getTime()) && instant.toISOString().startsWith(text);
};

/**
 * The app day the run works as of: today, or an earlier day the operator asked
 * for (OQ-237) — never a later one, which would post cash that isn't due yet.
 *
 * @param asOf - The `--today` option, if given.
 * @param now - The clock's instant.
 * @returns The run's `YYYY-MM-DD`.
 * @throws Error when `asOf` isn't a real day on or before today.
 */
const runDate = (asOf: string | undefined, now: Date): string => {
  const today = calendarDate(now, calendar.timeZone);
  if (asOf === undefined) return today;
  if (!isCalendarDay(asOf) || asOf > today) {
    throw new Error(`--today must be a YYYY-MM-DD day on or before ${today}, not "${asOf}"`);
  }
  return asOf;
};

/** The command's immediate runtime and logging boundary. */
export interface InvestmentsDailyCommandDeps {
  readonly run: InvestmentsDailyRun;
  readonly now: () => Date;
  /** Run as of this earlier app day instead of today (`--today`, OQ-237). */
  readonly asOf?: string | undefined;
  readonly close: () => Promise<void>;
  readonly onCompleted: (
    result: InvestmentsDailyResult | undefined, correlationId: CorrelationId,
  ) => void;
  readonly onError: (error: unknown, correlationId: CorrelationId) => void;
}

/**
 * Runs the same trigger once without opening HTTP or leaving a timer behind,
 * as of today or of an earlier day given with `--today` (OQ-237).
 *
 * @param deps - Job, clock, optional run date, resource cleanup and logging callbacks.
 * @returns Zero on completion/busy, one on failed or unconfirmed work or cleanup.
 */
export const runInvestmentsDailyCommand = async (
  deps: InvestmentsDailyCommandDeps,
): Promise<number> => {
  let exitCode = 0;
  const correlationId = newCorrelationId();
  try {
    const today = runDate(deps.asOf, deps.now());
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
