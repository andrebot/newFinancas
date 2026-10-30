import {
  describe, expect, it, vi,
} from 'vitest';
import type { AccountTransaction } from '../../../src/accessors/accountTransactionAccessor';
import type { ValuationSnapshot } from '../../../src/accessors/valuationSnapshotAccessor';
import {
  restateHoldingValues, tradeValuesOf, valueAfterTrade,
} from '../../../src/managers/holdingValues';

// A market-priced Holding's value over time (BDT: unit — the pure walk, then
// the restate over stand-ins for its two reads and its one write): the money
// moves it, a typed value sets it, every later value follows (OQ-222).

const CREATED = new Date('2026-10-13T12:00:00Z');

/**
 * A trade in the history.
 *
 * @param id - The transaction.
 * @param amount - Its money; a negative one is a sell.
 * @param units - Its signed units.
 * @param date - Its date.
 * @param createdAt - When it was written.
 * @returns The row.
 */
const trade = (
  id: string,
  amount: number,
  units: number,
  date: string,
  createdAt = CREATED,
): AccountTransaction => ({
  id,
  kind: amount > 0 ? 'investment_buy' : 'investment_sell',
  amount: Math.abs(amount),
  date,
  createdAt,
  trade: { quantityDelta: units, costBasisDelta: 0 },
} as AccountTransaction);

/**
 * A snapshot in the history.
 *
 * @param valuation - Its value.
 * @param asOfDate - Its date.
 * @param accountTransactionId - Its trade; none for a typed value.
 * @param createdAt - When it was written.
 * @returns The snapshot.
 */
const snapshot = (
  valuation: number,
  asOfDate: string,
  accountTransactionId: string | null = null,
  createdAt = CREATED,
): ValuationSnapshot => ({
  id: `s-${accountTransactionId ?? asOfDate}`,
  holdingId: 'h',
  valuation,
  asOfDate,
  source: accountTransactionId === null ? 'manual' : 'transaction',
  accountTransactionId,
  createdAt,
});

describe('valueAfterTrade', () => {
  it('adds what a buy paid, takes off what a sell brought in, never below zero', () => {
    expect(valueAfterTrade(30_000, 'out', 60_000, 3)).toBe(90_000);
    expect(valueAfterTrade(90_000, 'in', 50_000, 1)).toBe(40_000);
    expect(valueAfterTrade(30_000, 'in', 50_000, 1)).toBe(0);
  });

  it('values a sold-out position at zero', () => {
    expect(valueAfterTrade(90_000, 'in', 10_000, 0)).toBe(0);
  });
});

describe('tradeValuesOf', () => {
  const first = trade('a', 10_000, 1, '2026-10-01');
  const second = trade('b', 5_000, 1, '2026-10-02');

  it('walks the trades in date order, each adding to the value before it', () => {
    expect([...tradeValuesOf([second, first], [])]).toEqual([['a', 10_000], ['b', 15_000]]);
  });

  it('follows a trade moved past a later one, counting it once (PR #145 review)', () => {
    const moved = { ...first, date: '2026-10-03' };
    expect([...tradeValuesOf([second, moved], [])]).toEqual([['b', 5_000], ['a', 15_000]]);
  });

  it('starts again from a value typed in', () => {
    const typed = snapshot(40_000, '2026-10-01', null, new Date('2026-10-13T13:00:00Z'));
    const values = tradeValuesOf([first, second], [typed, snapshot(1, '2026-10-01', 'a')]);
    expect(values.get('b')).toBe(45_000);
  });

  it('orders a day\'s steps by when they were written', () => {
    const later = trade('later', 1_000, 1, '2026-10-01', new Date('2026-10-13T14:00:00Z'));
    expect([...tradeValuesOf([later, first], [])]).toEqual([['a', 10_000], ['later', 11_000]]);
  });

  it('values a sold-out position at zero, whatever was paid', () => {
    const out = trade('out', -1_000, -2, '2026-10-03');
    expect(tradeValuesOf([first, second, out], []).get('out')).toBe(0);
  });

  it('reads a trade with no units as moving none', () => {
    const bare = { ...first, trade: null };
    expect(tradeValuesOf([bare], []).get('a')).toBe(0);
  });
});

describe('restateHoldingValues', () => {
  it('writes only the snapshots whose value or date moved, one at a time', async () => {
    const updateAutomatic = vi.fn(async () => true);
    const stores = {
      accountTransactions: {
        listTrades: vi.fn(async () => [
          trade('a', 10_000, 1, '2026-10-01'),
          trade('b', 5_000, 1, '2026-10-02'),
          trade('c', 1_000, 1, '2026-10-04'),
        ]),
      },
      valuations: {
        list: vi.fn(async () => [
          snapshot(10_000, '2026-10-01', 'a'),
          snapshot(14_000, '2026-10-02', 'b'),
          snapshot(16_000, '2026-10-03', 'c'),
          // A snapshot whose trade is gone is left alone.
          snapshot(9, '2026-09-01', 'gone'),
        ]),
        updateAutomatic,
      },
    };

    await restateHoldingValues(stores, 'h');

    expect(stores.accountTransactions.listTrades).toHaveBeenCalledWith('h');
    expect(updateAutomatic.mock.calls).toEqual([
      ['b', { valuation: 15_000, asOfDate: '2026-10-02' }],
      ['c', { valuation: 16_000, asOfDate: '2026-10-04' }],
    ]);
  });
});
