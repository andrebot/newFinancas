import { describe, expect, it } from 'vitest';
import {
  ledgerViewOf, rowKeyOf,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerPages';
import { accountRowOf, cardRowOf, pageOf } from './fixtures';

// The ledger as loaded (BDT: Flow rules, unit — pure).

describe('ledgerViewOf', () => {
  it('appends the pages without drawing a row twice', () => {
    const first = accountRowOf({ id: 't1' });
    const second = cardRowOf({ id: 't1' });
    const view = ledgerViewOf([
      pageOf([first, second]),
      pageOf([accountRowOf({ id: 't1', description: 'again' }), accountRowOf({ id: 't2' })]),
    ]);

    expect(view.items.map(rowKeyOf)).toEqual(['account:t1', 'card:t1', 'account:t2']);
    expect(view.items[0]).toBe(first);
  });

  it("reads each day's nets, R$ first, a day split across pages once", () => {
    const view = ledgerViewOf([
      pageOf([], {
        dayTotals: [
          { date: '2026-09-12', currency: 'USD', net: -4_599 },
          { date: '2026-09-12', currency: 'BRL', net: -5_840 },
        ],
      }),
      pageOf([], {
        dayTotals: [
          { date: '2026-09-12', currency: 'BRL', net: -5_840 },
          { date: '2026-09-10', currency: 'USD' },
          { currency: 'BRL', net: 1 },
          { date: '2026-09-09', net: 1 },
        ],
      }),
    ]);

    expect(view.dayTotals.get('2026-09-12')).toEqual([
      { currency: 'BRL', net: -5_840 }, { currency: 'USD', net: -4_599 },
    ]);
    expect(view.dayTotals.get('2026-09-10')).toEqual([{ currency: 'USD', net: 0 }]);
    expect(view.dayTotals.has('2026-09-09')).toBe(false);
  });

  it("reads each month's count, skipping a malformed entry", () => {
    const view = ledgerViewOf([
      pageOf([], { monthCounts: [{ month: '2026-09', count: 7 }, { count: 3 }] }),
      pageOf([], { monthCounts: [{ month: '2026-08' }] }),
      {},
    ]);

    expect([...view.monthCounts]).toEqual([['2026-09', 7], ['2026-08', 0]]);
    expect(view.items).toEqual([]);
  });
});

describe('the day totals\' currencies (review V4)', () => {
  it('puts R$ before $, whichever came first', () => {
    const view = ledgerViewOf([pageOf([], {
      dayTotals: [
        { date: '2026-09-12', currency: 'USD', net: -4_599 },
        { date: '2026-09-12', currency: 'BRL', net: -5_840 },
      ],
    })]);
    expect(view.dayTotals.get('2026-09-12')?.map(({ currency }) => currency))
      .toEqual(['BRL', 'USD']);
  });
});
