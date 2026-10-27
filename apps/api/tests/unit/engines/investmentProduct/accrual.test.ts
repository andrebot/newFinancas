import { describe, expect, it } from 'vitest';
import { interestFor } from '../../../../src/engines/investmentProduct/accrual';

const YEAR_2025 = { from: '2025-01-02', to: '2026-01-02' };
const FIXED = { type: 'fixed', value: 105_000 } as const;

describe('interestFor', () => {
  it('accrues a fixed rate over actual/365 in the US', () => {
    expect(interestFor(100_000, { type: 'fixed', value: 105_000 }, 0, {
      from: '2025-01-01', to: '2026-01-01',
    }, 'US')).toBe(10_500);
  });

  it('accrues a fixed rate over business days/252 in Brazil (2025 has 252)', () => {
    expect(interestFor(100_000, FIXED, 0, YEAR_2025, 'BR')).toBe(10_500);
  });

  it.each(['cdi', 'selic'] as const)('applies percent of %s to its daily rate', (type) => {
    expect(interestFor(1_000_000, { type, value: 1_100_000 }, 104_000, {
      from: '2025-01-02', to: '2025-07-01',
    }, 'BR')).toBe(54_101);
  });

  it.each([
    ['selic', 1_000_000, 545, 49_342],
    ['cdi', 1_100_000, 10_000, 59_191],
  ] as const)('adds a spread on top of percent of %s (OQ-205)', (type, value, spread, interest) => {
    expect(interestFor(1_000_000, { type, value, spread }, 104_000, {
      from: '2025-01-02', to: '2025-07-01',
    }, 'BR')).toBe(interest);
  });

  it('is negative when the index fell by more than the spread', () => {
    expect(interestFor(1_000_000, { type: 'igpm', value: 30_000 }, -60_000, YEAR_2025, 'BR'))
      .toBe(-31_800);
  });

  it.each(['ipca', 'igpm'] as const)('adds the spread above %s', (type) => {
    expect(interestFor(1_000_000, { type, value: 55_000 }, 45_000, YEAR_2025, 'BR')).toBe(102_475);
  });

  it('ignores the index value on a fixed rate', () => {
    expect(interestFor(100_000, FIXED, 999_999, YEAR_2025, 'BR')).toBe(10_500);
  });

  it('is 0 over a period that does not move forward', () => {
    const backwards = { from: '2025-03-10', to: '2025-03-01' };
    expect(interestFor(100_000, FIXED, 0, backwards, 'US')).toBe(0);
    expect(interestFor(100_000, FIXED, 0, backwards, 'BR')).toBe(0);
  });

  it('stays a whole number of minor units over 30 years (no float drift)', () => {
    const interest = interestFor(123_456_789, { type: 'fixed', value: 123_456 }, 0, {
      from: '2025-01-01', to: '2055-01-01',
    }, 'US');

    expect(interest).toBe(3_942_535_828);
    expect(Number.isInteger(interest)).toBe(true);
  });
});
