import { describe, expect, it } from 'vitest';
import accrualPeriods from '../../../../src/engines/investmentProduct/coupons';

describe('accrualPeriods', () => {
  it('is one period, purchase to due date, at maturity', () => {
    expect(accrualPeriods('2025-03-10', '2027-01-01', 'at_maturity')).toEqual([
      { from: '2025-03-10', to: '2027-01-01' },
    ]);
  });

  it('counts semi-annual coupons back from the due date, the short period first', () => {
    expect(accrualPeriods('2025-03-10', '2027-01-01', 'semiannual')).toEqual([
      { from: '2025-03-10', to: '2025-07-01' },
      { from: '2025-07-01', to: '2026-01-01' },
      { from: '2026-01-01', to: '2026-07-01' },
      { from: '2026-07-01', to: '2027-01-01' },
    ]);
  });

  it('keeps the due date\'s day monthly, capped at each month\'s end', () => {
    expect(accrualPeriods('2025-01-15', '2025-05-31', 'monthly')).toEqual([
      { from: '2025-01-15', to: '2025-01-31' },
      { from: '2025-01-31', to: '2025-02-28' },
      { from: '2025-02-28', to: '2025-03-31' },
      { from: '2025-03-31', to: '2025-04-30' },
      { from: '2025-04-30', to: '2025-05-31' },
    ]);
  });

  it('has no zero-length first period when the purchase falls on a coupon date', () => {
    expect(accrualPeriods('2026-01-01', '2027-01-01', 'semiannual')).toEqual([
      { from: '2026-01-01', to: '2026-07-01' },
      { from: '2026-07-01', to: '2027-01-01' },
    ]);
  });

  it('is a single period when the due date is not after the purchase', () => {
    expect(accrualPeriods('2025-03-10', '2025-03-10', 'monthly')).toEqual([
      { from: '2025-03-10', to: '2025-03-10' },
    ]);
  });
});
