import { describe, expect, it } from 'vitest';
import { payoutsPathOf } from '../../../src/api/investmentsApi';

// The investment reads Track Investments and Review Insights share (BDT: unit,
// the address only — the reads themselves run through the real store in the
// Track Investments endpoint tests, which inject on top of them).

describe('payoutsPathOf', () => {
  it('asks for every Holding when none is chosen', () => {
    expect(payoutsPathOf({ householdId: 'd o', holdingIds: undefined, months: 12 }))
      .toBe('/households/d%20o/reports/payouts?months=12');
  });

  it('joins the chosen Holdings with commas (explode: false)', () => {
    const url = new URL(
      payoutsPathOf({ householdId: 'doe', holdingIds: ['a', 'b'], months: 3 }),
      'http://app.test',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({ months: '3', holdingIds: 'a,b' });
  });
});
