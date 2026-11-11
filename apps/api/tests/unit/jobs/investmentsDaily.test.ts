import {
  describe, expect, it, vi,
} from 'vitest';
import type { DueScheduleEntry, MaturedHolding }
  from '../../../src/accessors/investmentHoldingAccessor';
import { createInvestmentsDaily } from '../../../src/jobs/investmentsDaily';
import type { JobLock } from '../../../src/jobs/investmentsDailyLock';
import { newCorrelationId } from '../../../src/utilities/correlationId';

const TODAY = '2026-11-03';
const NOW = new Date('2026-11-03T12:00:00Z');
const CORRELATION_ID = newCorrelationId();
const ENTRY: DueScheduleEntry = {
  id: 'interest',
  holdingId: 'holding',
  accountId: 'account',
  householdId: 'household',
  kind: 'interest_payment',
  amount: 125,
  date: TODAY,
};
const MATURED: MaturedHolding = {
  holdingId: 'late',
  accountId: 'account',
  householdId: 'household',
  ownerUserId: null,
  visibility: 'shared',
  assetType: 'cdb',
  ticker: null,
  dueDate: '2026-11-02',
};
const EMPTY = {
  cashEvents: 0, maturedHoldings: 0, deferredHoldings: 0, deferredNotices: 0,
};

/**
 * Builds only the trigger's direct read, bus and exclusion boundary.
 *
 * @param entries - Due entries returned by the Accessor.
 * @param signal - The execution lock's lifetime.
 * @returns The invocation and its boundary spies.
 */
const setup = (
  entries: readonly DueScheduleEntry[] = [],
  signal = new AbortController().signal,
) => {
  const holdings = {
    findDueScheduleEntries: vi.fn().mockResolvedValue(entries),
    listSchedule: vi.fn().mockImplementation(async (ids: string[]) => entries
      .filter((entry) => ids.includes(entry.holdingId))
      .map((entry) => ({ ...entry, postedAt: NOW, createdAt: NOW }))),
    findMaturedWithPosition: vi.fn().mockResolvedValue([]),
  };
  const bus = { publish: vi.fn(), drain: vi.fn().mockResolvedValue(undefined) };
  const withLock = vi.fn<JobLock>(async (work) => work(signal));
  return {
    run: createInvestmentsDaily({ holdings, bus, withLock: withLock as JobLock }),
    holdings,
    bus,
    withLock,
  };
};

describe('investmentsDaily infrastructure trigger', () => {
  it('does not start a scan with a revoked lock', async () => {
    const controller = new AbortController();
    const error = new Error('lock already lost');
    controller.abort(error);
    const deps = setup([ENTRY], controller.signal);
    await expect(deps.run(TODAY, CORRELATION_ID)).rejects.toBe(error);
    expect(deps.holdings.findDueScheduleEntries).not.toHaveBeenCalled();
    expect(deps.bus.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['due', 0], ['cash-drain', 1], ['cash-confirm', 1],
    ['matured', 1], ['notice-drain', 2], ['notice-confirm', 2],
  ] as const)('stops further dispatch after lock loss at %s', async (stage, publishes) => {
    const controller = new AbortController();
    const error = new Error(`lock lost at ${stage}`);
    const deps = setup([ENTRY], controller.signal);
    const boundaries = {
      due: deps.holdings.findDueScheduleEntries,
      'cash-drain': deps.bus.drain,
      'cash-confirm': deps.holdings.listSchedule,
      matured: deps.holdings.findMaturedWithPosition,
      'notice-drain': deps.bus.drain,
      'notice-confirm': deps.holdings.findMaturedWithPosition,
    };
    // Replace the default maturity snapshot before installing the failure.
    deps.holdings.findMaturedWithPosition.mockReset().mockResolvedValue([]);
    if (stage === 'notice-drain' || stage === 'notice-confirm') {
      deps.holdings.findMaturedWithPosition.mockResolvedValueOnce([MATURED]);
    }
    if (stage === 'notice-drain') deps.bus.drain.mockResolvedValueOnce(undefined);
    boundaries[stage].mockImplementationOnce(async () => {
      controller.abort(error);
      return [];
    });
    await expect(deps.run(TODAY, CORRELATION_ID)).rejects.toBe(error);
    expect(deps.bus.publish).toHaveBeenCalledTimes(publishes);
  });

  it('settles an already-published event before reporting the revoked lock', async () => {
    const controller = new AbortController();
    const error = new Error('lock lost while a subscriber runs');
    const deps = setup([ENTRY, { ...ENTRY, id: 'next', kind: 'redemption' }], controller.signal);
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    deps.bus.publish.mockImplementationOnce(() => controller.abort(error));
    deps.bus.drain.mockReturnValueOnce(pending);
    const settled = vi.fn();
    const running = deps.run(TODAY, CORRELATION_ID)
      .then(() => 'completed', (failure: unknown) => failure).finally(settled);
    await Promise.resolve();
    await Promise.resolve();
    expect(deps.bus.drain).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
    finish();
    expect(await running).toBe(error);
    expect(deps.bus.publish).toHaveBeenCalledTimes(1);
    expect(deps.holdings.listSchedule).not.toHaveBeenCalled();
    expect(deps.holdings.findMaturedWithPosition).not.toHaveBeenCalled();
  });

  it('does nothing while another process owns the lock', async () => {
    const deps = setup([ENTRY]);
    deps.withLock.mockResolvedValueOnce(undefined);
    expect(await deps.run(TODAY, CORRELATION_ID)).toBeUndefined();
    expect(deps.holdings.findDueScheduleEntries).not.toHaveBeenCalled();
    expect(deps.bus.publish).not.toHaveBeenCalled();
  });

  it('reads both empty streams using the same app calendar date', async () => {
    const deps = setup();
    expect(await deps.run(TODAY, CORRELATION_ID)).toEqual(EMPTY);
    expect(deps.holdings.findDueScheduleEntries).toHaveBeenCalledWith(TODAY);
    expect(deps.holdings.findMaturedWithPosition.mock.calls).toEqual([[TODAY], [TODAY]]);
    expect(deps.holdings.listSchedule).not.toHaveBeenCalled();
    expect(deps.bus.publish).not.toHaveBeenCalled();
  });

  it('translates all three kinds and drains/confirms each before the next', async () => {
    const entries = [
      {
        ...ENTRY, id: 'a-redemption', kind: 'redemption', amount: 10000,
      },
      { ...ENTRY, id: 'c-interest' },
      {
        ...ENTRY, id: 'b-tax', kind: 'tax', amount: 25,
      },
      { ...ENTRY, id: 'd-old', date: '2026-11-01' },
    ];
    const original = structuredClone(entries);
    const deps = setup(entries);
    deps.holdings.findMaturedWithPosition.mockResolvedValueOnce([MATURED]);

    expect(await deps.run(TODAY, CORRELATION_ID)).toEqual({
      cashEvents: 4, maturedHoldings: 1, deferredHoldings: 0, deferredNotices: 0,
    });
    expect(deps.bus.publish.mock.calls).toEqual([
      ['transaction.import.requested', {
        scheduleEntryId: 'd-old',
        householdId: 'household',
        accountId: 'account',
        holdingId: 'holding',
        kind: 'investment_interest',
        amount: 125,
        date: '2026-11-01',
      }, CORRELATION_ID],
      ['transaction.import.requested', {
        scheduleEntryId: 'b-tax',
        householdId: 'household',
        accountId: 'account',
        holdingId: 'holding',
        kind: 'investment_tax',
        amount: 25,
        date: TODAY,
      }, CORRELATION_ID],
      ['transaction.import.requested', {
        scheduleEntryId: 'c-interest',
        householdId: 'household',
        accountId: 'account',
        holdingId: 'holding',
        kind: 'investment_interest',
        amount: 125,
        date: TODAY,
      }, CORRELATION_ID],
      ['transaction.import.requested', {
        scheduleEntryId: 'a-redemption',
        householdId: 'household',
        accountId: 'account',
        holdingId: 'holding',
        kind: 'investment_redemption',
        amount: 10000,
        date: TODAY,
      }, CORRELATION_ID],
      ['holding.matured', MATURED, CORRELATION_ID],
    ]);
    const publishes = deps.bus.publish.mock.invocationCallOrder;
    const drains = deps.bus.drain.mock.invocationCallOrder;
    const confirms = deps.holdings.listSchedule.mock.invocationCallOrder;
    expect(drains).toHaveLength(5);
    confirms.forEach((confirmedAt, index) => {
      expect(publishes[index]).toBeLessThan(drains[index]!);
      expect(drains[index]).toBeLessThan(confirmedAt);
      expect(confirmedAt).toBeLessThan(publishes[index + 1]!);
    });
    expect(confirms[3]).toBeLessThan(
      deps.holdings.findMaturedWithPosition.mock.invocationCallOrder[0]!,
    );
    expect(entries).toEqual(original);
  });

  it('redeems last on its day, even read after the interest with an id sorting first', async () => {
    const deps = setup([
      { ...ENTRY, id: 'c-interest' },
      { ...ENTRY, id: 'a-redemption', kind: 'redemption' },
    ]);

    await deps.run(TODAY, CORRELATION_ID);

    expect(deps.bus.publish.mock.calls.map((call) => call[1].scheduleEntryId))
      .toEqual(['c-interest', 'a-redemption']);
  });

  it.each([false, true])(
    'defers an unconfirmed Holding (missing marker: %s), not its siblings',
    async (missing) => {
      const deps = setup([
        ENTRY,
        { ...ENTRY, id: 'principal', kind: 'redemption' },
        { ...ENTRY, id: 'sibling', holdingId: 'other' },
      ]);
      deps.holdings.listSchedule.mockResolvedValueOnce(missing ? [] : [
        { ...ENTRY, id: 'unrelated', postedAt: NOW },
        { ...ENTRY, postedAt: null },
      ]);
      expect(await deps.run(TODAY, CORRELATION_ID)).toEqual({
        ...EMPTY, cashEvents: 2, deferredHoldings: 1,
      });
      expect(deps.bus.publish.mock.calls.map((call) => call[1].scheduleEntryId))
        .toEqual(['interest', 'sibling']);
    },
  );

  it('reports only the attempted notices still pending, including partial delivery', async () => {
    const deps = setup();
    deps.holdings.findMaturedWithPosition
      .mockResolvedValueOnce([MATURED, { ...MATURED, holdingId: 'delivered' }])
      .mockResolvedValueOnce([MATURED, { ...MATURED, holdingId: 'newly-due' }]);
    expect(await deps.run(TODAY, CORRELATION_ID)).toEqual({
      ...EMPTY, maturedHoldings: 2, deferredNotices: 1,
    });
    expect(deps.bus.drain).toHaveBeenCalledTimes(2);
  });

  it('re-reads durable markers on another run instead of caching work in memory', async () => {
    const deps = setup([ENTRY]);
    await deps.run(TODAY, CORRELATION_ID);
    deps.holdings.findDueScheduleEntries.mockResolvedValueOnce([]);
    expect(await deps.run(TODAY, CORRELATION_ID)).toEqual(EMPTY);
    expect(deps.bus.publish).toHaveBeenCalledTimes(1);
  });

  it.each(['unknown', 'toString'])(
    'fails loudly on persisted kind %s, without publishing it',
    async (kind) => {
      const deps = setup([{ ...ENTRY, kind }]);
      await expect(deps.run(TODAY, CORRELATION_ID))
        .rejects.toThrow(`Unknown investment schedule kind ${kind}`);
      expect(deps.bus.publish).not.toHaveBeenCalled();
    },
  );

  it.each(['scan', 'confirm', 'drain', 'matured', 'notice-confirm', 'lock'])(
    'propagates a failed %s rather than reporting completion',
    async (failure) => {
      const deps = setup([ENTRY]);
      const error = new Error(failure);
      const boundary = {
        scan: deps.holdings.findDueScheduleEntries,
        confirm: deps.holdings.listSchedule,
        drain: deps.bus.drain,
        matured: deps.holdings.findMaturedWithPosition,
        'notice-confirm': deps.holdings.findMaturedWithPosition,
        lock: deps.withLock,
      }[failure]!;
      if (failure === 'notice-confirm') boundary.mockResolvedValueOnce([]);
      boundary.mockRejectedValueOnce(error);
      await expect(deps.run(TODAY, CORRELATION_ID)).rejects.toBe(error);
    },
  );
});
