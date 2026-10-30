import { describe, expect, it } from 'vitest';
import { signedSpend, spendByMonth } from '../../../src/managers/budgetSpend';

// A Budget's spend (BDT: unit, pure): the sign each direction gives an amount,
// and the ledgers' sums folded into each month's spend in one currency.

describe('signedSpend', () => {
  it('counts money out as spend and money in against it (OQ-201 D4)', () => {
    expect(signedSpend('out', 1200)).toBe(1200);
    expect(signedSpend('in', 1200)).toBe(-1200);
  });
});

describe('spendByMonth', () => {
  it('nets each month\'s kinds by their direction, in the Budget\'s currency only', () => {
    expect(spendByMonth([
      {
        month: '2026-10', currency: 'BRL', kind: 'charge', total: 20000,
      },
      {
        month: '2026-10', currency: 'BRL', kind: 'refund', total: 500,
      },
      {
        month: '2026-11', currency: 'BRL', kind: 'pix_payment', total: 300,
      },
      {
        month: '2026-10', currency: 'USD', kind: 'charge', total: 999,
      },
    ], 'BRL')).toEqual([
      { month: { year: 2026, month: 10 }, amount: 19500 },
      { month: { year: 2026, month: 11 }, amount: 300 },
    ]);
  });

  it('answers no month for no sums', () => {
    expect(spendByMonth([], 'BRL')).toEqual([]);
  });
});
