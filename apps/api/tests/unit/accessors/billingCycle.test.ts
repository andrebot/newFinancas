import { describe, expect, it } from 'vitest';
import cycleOf from '../../../src/accessors/billingCycle';

describe('cycleOf', () => {
  it('puts a day up to the closing day in the cycle closing that month', () => {
    expect(cycleOf('2026-10-03', 5)).toEqual({ year: 2026, month: 10 });
    expect(cycleOf('2026-10-05', 5)).toEqual({ year: 2026, month: 10 });
  });

  it('puts a day after the closing day in the next month\'s cycle', () => {
    expect(cycleOf('2026-10-06', 5)).toEqual({ year: 2026, month: 11 });
  });

  it('rolls December\'s late days into January\'s cycle', () => {
    expect(cycleOf('2026-12-20', 10)).toEqual({ year: 2027, month: 1 });
  });

  it('closes on a short month\'s last day when the closing day is past it', () => {
    expect(cycleOf('2026-02-28', 31)).toEqual({ year: 2026, month: 2 });
    expect(cycleOf('2028-02-29', 30)).toEqual({ year: 2028, month: 2 });
    expect(cycleOf('2026-03-01', 31)).toEqual({ year: 2026, month: 3 });
  });
});
