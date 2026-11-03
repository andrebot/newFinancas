import type {
  DueScheduleEntry, InvestmentHoldingAccessor,
} from '../accessors/investmentHoldingAccessor';
import type { CorrelationId } from '../utilities/correlationId';
import type { BusEvents, ServiceBus } from '../utilities/serviceBus';
import type { JobLock } from './investmentsDailyLock';

/** Only the trigger's existing read boundary, never a Manager or an Engine. */
export interface InvestmentsDailyDeps {
  readonly holdings: Pick<InvestmentHoldingAccessor,
    'findDueScheduleEntries' | 'listSchedule' | 'findMaturedWithPosition'>;
  readonly bus: Pick<ServiceBus, 'publish' | 'drain'>;
  readonly withLock: JobLock;
}

/** Published events and unconfirmed Holdings, not a promise of successful delivery. */
export interface InvestmentsDailyResult {
  readonly cashEvents: number;
  readonly maturedHoldings: number;
  readonly deferredHoldings: number;
  readonly deferredNotices: number;
}

/** The trigger's one invocation; undefined means the database lock was busy. */
export type InvestmentsDailyRun = (
  today: string, correlationId: CorrelationId,
) => Promise<InvestmentsDailyResult | undefined>;

/** Schedule-to-ledger translation, not a payout calculation (FR-11.3). */
const TRANSACTION_KIND = new Map([
  ['interest_payment', 'investment_interest'],
  ['tax', 'investment_tax'],
  ['redemption', 'investment_redemption'],
]);

/**
 * Translates a persisted cash event to the bus's existing transaction contract.
 *
 * @param entry - The Engine's persisted schedule entry.
 * @returns Its transaction event, with amounts and dates unchanged.
 */
const transactionPayload = (entry: DueScheduleEntry): BusEvents['transaction.import.requested'] => {
  const kind = TRANSACTION_KIND.get(entry.kind);
  if (!kind) throw new Error(`Unknown investment schedule kind ${entry.kind}`);
  return {
    scheduleEntryId: entry.id,
    householdId: entry.householdId,
    accountId: entry.accountId,
    holdingId: entry.holdingId,
    kind,
    amount: entry.amount,
    date: entry.date,
  };
};

/**
 * Orders cash events chronologically, with principal redeemed last on each day.
 *
 * @param first - One due entry.
 * @param second - Another due entry.
 * @returns Their chronological and redemption-last ordering.
 */
const compareEntries = (first: DueScheduleEntry, second: DueScheduleEntry): number => (
  first.date.localeCompare(second.date)
    || Number(first.kind === 'redemption') - Number(second.kind === 'redemption')
    || first.id.localeCompare(second.id)
);

/**
 * Groups a snapshot without changing it, preserving each Holding's cash order.
 *
 * @param entries - All unposted, overdue or due entries.
 * @returns Ordered entries per Holding.
 */
const groupEntries = (entries: readonly DueScheduleEntry[]): DueScheduleEntry[][] => {
  const groups = new Map<string, DueScheduleEntry[]>();
  [...entries].sort(compareEntries).forEach((entry) => {
    const group = groups.get(entry.holdingId) ?? [];
    group.push(entry);
    groups.set(entry.holdingId, group);
  });
  return [...groups.values()];
};

/**
 * Dispatches one Holding in order; an unconfirmed entry must not be overtaken.
 * Bus failures stay isolated: the existing posted marker confirms delivery.
 *
 * @param deps - The read and bus boundary.
 * @param entries - One Holding's entries, chronologically ordered.
 * @param correlationId - This run's logging context.
 * @returns Published count and whether this Holding must retry tomorrow.
 */
const postHolding = async (
  deps: InvestmentsDailyDeps,
  entries: readonly DueScheduleEntry[],
  correlationId: CorrelationId,
) => {
  let published = 0;
  for (const entry of entries) {
    deps.bus.publish('transaction.import.requested', transactionPayload(entry), correlationId);
    // eslint-disable-next-line no-await-in-loop -- cash events must not overtake each other
    await deps.bus.drain();
    published += 1;
    // eslint-disable-next-line no-await-in-loop -- confirm before any later redemption
    const schedule = await deps.holdings.listSchedule([entry.holdingId]);
    const confirmed = schedule.some((item) => item.id === entry.id && item.postedAt !== null);
    if (!confirmed) return { published, deferred: 1 };
  }
  return { published, deferred: 0 };
};

/**
 * Publishes the cash stream before reading the surviving matured positions.
 *
 * @param deps - The trigger's immediate boundary.
 * @param today - The app calendar date, inclusive for cash, exclusive for maturity.
 * @param correlationId - This run's logging context.
 * @returns Counts including any delivery left for the next daily run.
 */
const dispatch = async (
  deps: InvestmentsDailyDeps,
  today: string,
  correlationId: CorrelationId,
): Promise<InvestmentsDailyResult> => {
  const entries = await deps.holdings.findDueScheduleEntries(today);
  let cashEvents = 0;
  let deferredHoldings = 0;
  for (const group of groupEntries(entries)) {
    // eslint-disable-next-line no-await-in-loop -- serialize even Holdings sharing an Account
    const result = await postHolding(deps, group, correlationId);
    cashEvents += result.published;
    deferredHoldings += result.deferred;
  }
  const matured = await deps.holdings.findMaturedWithPosition(today);
  for (const holding of matured) {
    deps.bus.publish('holding.matured', holding, correlationId);
    // eslint-disable-next-line no-await-in-loop -- notification completion precedes lock release
    await deps.bus.drain();
  }
  const remaining = await deps.holdings.findMaturedWithPosition(today);
  const deferredNotices = matured.filter((holding) => (
    remaining.some((pending) => pending.holdingId === holding.holdingId)
  )).length;
  return {
    cashEvents, maturedHoldings: matured.length, deferredHoldings, deferredNotices,
  };
};

/**
 * Builds N9: a local infrastructure trigger, never a new domain orchestrator.
 * Durable idempotency stays in the Managers' existing posted/notified writes.
 *
 * @param deps - Existing Holding reads, service bus and execution lock.
 * @returns The daily/manual invocation, skipped if another process owns the lock.
 */
export const createInvestmentsDaily = (deps: InvestmentsDailyDeps): InvestmentsDailyRun => (
  (today, correlationId) => deps.withLock(() => dispatch(deps, today, correlationId))
);
