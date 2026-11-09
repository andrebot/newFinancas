import type {
  IndexRateSeries, InvestmentHolding, ValuationSnapshot,
} from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  accountCardsOf, allocationRowsOf, allocationsOf, averagePriceOf, contractTermOf,
  groupsTotalOf, historyEntriesOf, holdingGroupsOf, holdingValueOf, isSplitChanged,
  latestIndexOf, monthlyYieldOf, payoutThisMonthOf, signedActivityAmountOf, typeSharesOf,
  unitsOf, valueChangeOf, type HoldingGoal,
} from '../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/holdingMaintenance';
import {
  HOLDINGS, INVESTMENT_ACCOUNTS, OVERVIEW, holdingOf,
} from '../../../portfolioFixtures';
import { accountOf } from '../../../monthFixtures';

// Holding Maintenance's arithmetic (BDT: the Flow's pure model → unit, nothing
// mocked), over mockup 50/51's household.

const SLICES = OVERVIEW.allocations;

/**
 * Builds a Holding missing one field, as an older read might send it.
 *
 * @param id - Its id.
 * @param field - The field left out.
 * @returns The Holding.
 */
const without = (id: string, field: keyof InvestmentHolding): InvestmentHolding => {
  const holding: Partial<InvestmentHolding> = { ...holdingOf(id) };
  delete holding[field];
  return holding;
};

/**
 * Builds an index value, as the Rates read sends one.
 *
 * @param value - Percent × 10,000.
 * @returns The value.
 */
const indexValueOf = (value: number): IndexRateSeries['values'][number] => ({
  id: String(value),
  index: 'selic',
  value,
  asOf: '2026-09-01',
  createdByUserId: null,
  createdAt: '2026-09-01T00:00:00Z',
});
const XP = HOLDINGS.filter((holding) => holding.accountId === 'xp');

describe('holdingValueOf', () => {
  it('reads the Holding\'s slice in its currency', () => {
    expect(holdingValueOf(holdingOf('xpml11'), SLICES, 'BRL')).toBe(11000000);
  });

  it('falls back to a fixed-term Holding\'s cost basis, nothing for a market-priced one', () => {
    expect(holdingValueOf(
      holdingOf('ipca35', { assetType: 'tesouro_direto', costBasis: 6000000 }),
      SLICES,
      'BRL',
    )).toBe(6000000);
    expect(holdingValueOf(holdingOf('ipca35', { assetType: 'cdb' }), SLICES, 'BRL')).toBe(0);
    expect(holdingValueOf(holdingOf('old11'), SLICES, 'BRL')).toBe(0);
    expect(holdingValueOf(without('x', 'assetType'), SLICES, 'BRL')).toBe(0);
    expect(holdingValueOf(without('x', 'id'), SLICES, 'BRL')).toBe(0);
    expect(holdingValueOf(
      { ...without('x', 'costBasis'), assetType: 'cdb' },
      SLICES,
      'BRL',
    )).toBe(0);
  });
});

describe('accountCardsOf', () => {
  it('lists every account holding something, in order, with its value and open count', () => {
    const cards = accountCardsOf(
      [accountOf('empty'), ...INVESTMENT_ACCOUNTS],
      HOLDINGS,
      SLICES,
    );

    expect(cards.map((card) => [card.account.id, card.value, card.openHoldings])).toEqual([
      ['xp', 15860000, 4],
      ['checking', 878000, 2],
      ['savings', 500000, 1],
    ]);
  });

  it('values an account the report leaves out at nothing', () => {
    expect(accountCardsOf(INVESTMENT_ACCOUNTS, HOLDINGS, [])[0]?.value).toBe(0);
  });
});

describe('holdingGroupsOf', () => {
  it('groups fixed income before variable income, largest first, archived last', () => {
    const groups = holdingGroupsOf(
      [...XP, holdingOf('aaa11', { archivedAt: '2026-01-01T00:00:00Z' })],
      SLICES,
      'BRL',
    );

    expect(groups.map((group) => [group.kind, group.total])).toEqual([
      ['fixedIncome', 0],
      ['variableIncome', 15860000],
    ]);
    expect(groups[1]?.rows.map((row) => row.holding.id))
      .toEqual(['xpml11', 'knri11', 'vale3', 'aaa11', 'old11']);
    expect(groups[1]?.rows.at(-1)?.archived).toBe(true);
  });

  it('orders equal values by ticker, and leaves an empty group out', () => {
    const groups = holdingGroupsOf(
      [holdingOf('b'), holdingOf('a'), without('c', 'ticker')],
      [],
      'BRL',
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows.map((row) => row.holding.id)).toEqual(['c', 'a', 'b']);
  });

  it('puts an archived row after an active one whichever comes first', () => {
    const archived = holdingOf('z', { archivedAt: '2026-01-01T00:00:00Z' });
    const rows = (order: typeof XP) => holdingGroupsOf(order, [], 'BRL')[0]?.rows
      .map((row) => row.holding.id);

    expect(rows([archived, holdingOf('y')])).toEqual(['y', 'z']);
    expect(rows([holdingOf('y'), archived])).toEqual(['y', 'z']);
    expect(rows([holdingOf('a'), without('n', 'ticker')])).toEqual(['n', 'a']);
  });
});

describe('groupsTotalOf and typeSharesOf', () => {
  it('adds up the account and shares it out by type, largest first', () => {
    const groups = holdingGroupsOf(XP, SLICES, 'BRL');

    expect(groupsTotalOf(groups)).toBe(15860000);
    expect(typeSharesOf(groups)).toEqual([
      { assetType: 'fii', amount: 15500000, percent: 98 },
      { assetType: 'stock', amount: 360000, percent: 2 },
    ]);
  });

  it('shares nothing out of an account worth nothing, and names a missing type other', () => {
    expect(typeSharesOf(holdingGroupsOf([holdingOf('x')], [], 'BRL'))).toEqual([]);
    expect(typeSharesOf(holdingGroupsOf(
      [without('x', 'assetType')],
      [{
        kind: 'holding', key: 'x', currency: 'BRL', amount: 5,
      }],
      'BRL',
    ))).toEqual([{ assetType: 'other', amount: 5, percent: 100 }]);
  });
});

describe('contractTermOf', () => {
  it('tells the share of the term gone and the years and months to go (mockup 51)', () => {
    expect(contractTermOf('2025-01-10', '2029-03-15', '2026-10-01')).toEqual({
      elapsedPercent: 41, yearsLeft: 2, monthsLeft: 5,
    });
  });

  it('counts a month short when the day isn\'t reached yet', () => {
    expect(contractTermOf('2026-01-01', '2027-01-10', '2026-10-20'))
      .toMatchObject({ yearsLeft: 0, monthsLeft: 2 });
  });

  it('is fully run on and past the due date, and before the buy is not started', () => {
    expect(contractTermOf('2025-01-10', '2026-01-10', '2026-03-01')).toEqual({
      elapsedPercent: 100, yearsLeft: 0, monthsLeft: 0,
    });
    expect(contractTermOf('2026-01-10', '2027-01-10', '2025-12-01').elapsedPercent).toBe(0);
    expect(contractTermOf('2026-01-10', '2026-01-10', '2026-01-10').elapsedPercent).toBe(100);
  });
});

describe('averagePriceOf and unitsOf', () => {
  it('divides the cost by the units', () => {
    expect(averagePriceOf(holdingOf('x', { quantity: 120_000_000_000, costBasis: 11000000 })))
      .toBe(9167);
    expect(unitsOf(120_000_000_000)).toBe(1200);
    expect(unitsOf(undefined)).toBe(0);
  });

  it('has no average without units, and counts no cost as nothing', () => {
    expect(averagePriceOf(holdingOf('x', { quantity: 0 }))).toBeNull();
    expect(averagePriceOf(without('x', 'quantity'))).toBeNull();
    expect(averagePriceOf(holdingOf('x', { quantity: 100_000_000 }))).toBe(0);
  });
});

describe('payoutThisMonthOf and monthlyYieldOf', () => {
  it('adds up the Holding\'s payouts in its currency', () => {
    expect(payoutThisMonthOf(OVERVIEW.payoutThisMonth, 'xpml11', 'BRL')).toBe(89000);
    expect(payoutThisMonthOf(OVERVIEW.payoutThisMonth, 'xpml11', 'USD')).toBe(0);
  });

  it('yields the payout over the value, nothing without either', () => {
    expect(monthlyYieldOf(89000, 11000000)).toBeCloseTo(0.00809);
    expect(monthlyYieldOf(0, 11000000)).toBeNull();
    expect(monthlyYieldOf(89000, 0)).toBeNull();
  });
});

describe('historyEntriesOf', () => {
  it('keeps the order and locks a trade\'s snapshot with the reason', () => {
    const snapshots: ValuationSnapshot[] = [
      {
        id: 'b', asOfDate: '2026-08-31', valuation: 11000000, source: 'manual',
      },
      {
        id: 'a', asOfDate: '2026-03-20', valuation: 3680000, source: 'transaction',
      },
      {},
    ];

    expect(historyEntriesOf(snapshots, 'From a trade')).toEqual([
      {
        key: 'b', date: '2026-08-31', value: 11000000, lockedReason: undefined,
      },
      {
        key: 'a', date: '2026-03-20', value: 3680000, lockedReason: 'From a trade',
      },
      {
        key: '', date: '', value: 0, lockedReason: undefined,
      },
    ]);
  });
});

describe('valueChangeOf', () => {
  it('compares with the current value', () => {
    expect(valueChangeOf(11000000, 11248000))
      .toEqual({ amount: 248000, ratio: 0.022545454545454546 });
  });

  it('has no ratio with nothing to compare', () => {
    expect(valueChangeOf(undefined, 500)).toEqual({ amount: 500, ratio: null });
    expect(valueChangeOf(0, 500)).toEqual({ amount: 500, ratio: null });
  });
});

describe('allocationRowsOf, allocationsOf and isSplitChanged', () => {
  const goals: HoldingGoal[] = [
    {
      id: 'house', name: 'House', progress: 40, completed: false,
    },
    {
      id: 'trip', name: 'Trip', progress: 100, completed: true,
    },
  ];

  it('names the visible shares and leaves a hidden Goal\'s to the server', () => {
    const rows = allocationRowsOf([
      { goalId: 'house', percentage: 45 },
      { goalId: 'hidden', percentage: 10 },
      { goalId: 'trip', percentage: 5 },
    ], goals);

    expect(rows).toEqual([
      {
        goalId: 'house', name: 'House', percent: 45, progress: 40, completed: false,
      },
      {
        goalId: 'trip', name: 'Trip', percent: 5, progress: 100, completed: true,
      },
    ]);
    expect(allocationsOf(rows)).toEqual([
      { goalId: 'house', percentage: 45 }, { goalId: 'trip', percentage: 5 },
    ]);
    expect(allocationsOf([{ goalId: 'x', name: 'X', percent: null }]))
      .toEqual([{ goalId: 'x', percentage: 0 }]);
  });

  it('tells a changed split from the saved one', () => {
    const saved = allocationRowsOf([{ goalId: 'house', percentage: 45 }], goals);

    expect(isSplitChanged(saved, saved)).toBe(false);
    expect(isSplitChanged([{ ...saved[0]!, percent: 50 }], saved)).toBe(true);
    expect(isSplitChanged([{ ...saved[0]!, goalId: 'trip' }], saved)).toBe(true);
    expect(isSplitChanged([], saved)).toBe(true);
  });
});

describe('latestIndexOf', () => {
  it('reads an index\'s newest value and unit', () => {
    const series: IndexRateSeries[] = [
      { index: 'ipca', unit: 'trailing_12m_percent', values: [] },
      {
        index: 'selic',
        unit: 'annual_percent',
        values: [indexValueOf(105000), indexValueOf(100000)],
      },
    ];

    expect(latestIndexOf(series, 'selic')).toEqual({ value: 105000, unit: 'annual_percent' });
    expect(latestIndexOf(series, 'ipca')).toBeUndefined();
    expect(latestIndexOf(series, 'cdi')).toBeUndefined();
  });
});

describe('signedActivityAmountOf', () => {
  it('signs money out negative, money in positive', () => {
    expect(signedActivityAmountOf('investment_buy', 3680000)).toBe(-3680000);
    expect(signedActivityAmountOf('investment_dividend', 89000)).toBe(89000);
    expect(signedActivityAmountOf(undefined, undefined)).toBe(0);
  });
});
