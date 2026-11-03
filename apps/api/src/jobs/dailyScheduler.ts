import { calendar, investmentsDaily } from '../config/constants';
import calendarDate from '../utilities/calendar';
import { newCorrelationId } from '../utilities/correlationId';
import type { InvestmentsDailyResult, InvestmentsDailyRun } from './investmentsDaily';

/** Timer policy depends only on the job, a clock and its external log sink. */
export interface DailySchedulerDeps {
  readonly run: InvestmentsDailyRun;
  readonly now: () => Date;
  readonly onCompleted: (result: InvestmentsDailyResult | undefined) => void;
  readonly onError: (error: unknown) => void;
}

/**
 * Starts immediately to catch overdue entries, then once per app calendar day.
 * A busy lock or failed scan retries next tick; deferred deliveries wait a day.
 *
 * @param deps - Job, clock and logging callbacks.
 * @returns An idempotent stop that clears the timer and waits for active work.
 */
export const startDailyScheduler = (deps: DailySchedulerDeps): (() => Promise<void>) => {
  let lastDay: string | undefined;
  let pending: Promise<void> | undefined;

  /**
   * Runs a single calendar day's attempt, consuming errors at the timer boundary.
   *
   * @param today - The date captured at invocation, never at completion.
   * @returns Resolves after the attempt and its log callback.
   */
  const attempt = async (today: string): Promise<void> => {
    try {
      const result = await deps.run(today, newCorrelationId());
      if (result !== undefined) lastDay = today;
      deps.onCompleted(result);
    } catch (error) {
      deps.onError(error);
    }
  };

  /** Starts a due attempt without overlapping another; returns no timer promise. */
  const tick = (): void => {
    if (pending) return;
    const today = calendarDate(deps.now(), calendar.timeZone);
    if (lastDay === today) return;
    pending = attempt(today).finally(() => {
      pending = undefined;
    });
  };

  const timer = setInterval(tick, investmentsDaily.pollIntervalMs);
  tick();
  return async () => {
    clearInterval(timer);
    await pending;
  };
};
