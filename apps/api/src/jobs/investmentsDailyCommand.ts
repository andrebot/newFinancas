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
 * @param today - The app day the run worked as of (OQ-237: not always the real one).
 * @returns Nothing.
 */
export const reportInvestmentsDaily = (
  result: InvestmentsDailyResult | undefined,
  correlationId: CorrelationId,
  today: string,
): void => {
  const log = createLogger({ label: 'investmentsDaily', correlationId, actor: 'system' });
  if (result === undefined) {
    log.info('investmentsDaily skipped: another run owns the lock', { today });
    return;
  }
  if (result.deferredHoldings + result.deferredNotices > 0) {
    log.warn('investmentsDaily completed with deferred deliveries', { today, ...result });
    return;
  }
  log.info('investmentsDaily completed', { today, ...result });
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
const TODAY_OPTION = '--today';

/**
 * Picks out every argument that looks like the `--today` option, unchecked
 * (OQ-237) — a malformed one too (`--today 2020-07-02`, `--todayx`), so the
 * command refuses it instead of quietly running as of the real today.
 *
 * @param argv - The process arguments.
 * @returns Each `--today…` argument as given; empty when there is none.
 */
export const todayArguments = (argv: readonly string[]): readonly string[] => (
  argv.filter((argument) => argument.startsWith(TODAY_OPTION))
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
 * The app day the run works as of: today, or an earlier day asked for with one
 * `--today=YYYY-MM-DD` (OQ-237) — never a later one, which would post cash that
 * isn't due yet.
 *
 * @param todayArgs - The `--today…` arguments, as `todayArguments` found them.
 * @param now - The clock's instant.
 * @returns The run's `YYYY-MM-DD`.
 * @throws Error unless there is none, or exactly one naming a real day on or before today.
 */
const runDate = (todayArgs: readonly string[], now: Date): string => {
  const today = calendarDate(now, calendar.timeZone);
  if (todayArgs.length === 0) return today;
  const asOf = todayArgs[0]!.slice(`${TODAY_OPTION}=`.length);
  const wellFormed = todayArgs.length === 1 && todayArgs[0]!.startsWith(`${TODAY_OPTION}=`);
  if (!wellFormed || !isCalendarDay(asOf) || asOf > today) {
    throw new Error(`--today takes one YYYY-MM-DD day on or before ${today}, as `
      + `--today=YYYY-MM-DD; got "${todayArgs.join(' ')}"`);
  }
  return asOf;
};

/** The command's immediate runtime and logging boundary. */
export interface InvestmentsDailyCommandDeps {
  readonly run: InvestmentsDailyRun;
  readonly now: () => Date;
  /** The `--today…` arguments: run as of that earlier app day instead (OQ-237). */
  readonly todayArgs?: readonly string[];
  readonly close: () => Promise<void>;
  readonly onCompleted: (
    result: InvestmentsDailyResult | undefined, correlationId: CorrelationId, today: string,
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
    const today = runDate(deps.todayArgs ?? [], deps.now());
    const result = await deps.run(today, correlationId);
    deps.onCompleted(result, correlationId, today);
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
