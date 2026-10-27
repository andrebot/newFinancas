import { describe, expect, it } from 'vitest';
import { monthEnd, monthKey, yearMonths } from '../../../../src/engines/reporting/months';

describe('monthKey', () => {
  it('formats a month as YYYY-MM, zero-padded (OQ-201)', () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe('2026-03');
    expect(monthKey({ year: 2026, month: 11 })).toBe('2026-11');
  });
});

describe('monthEnd', () => {
  it('is the month\'s last day, leap years included', () => {
    expect(monthEnd({ year: 2026, month: 2 })).toBe('2026-02-28');
    expect(monthEnd({ year: 2028, month: 2 })).toBe('2028-02-29');
    expect(monthEnd({ year: 2026, month: 12 })).toBe('2026-12-31');
    expect(monthEnd({ year: 2026, month: 4 })).toBe('2026-04-30');
  });
});

describe('yearMonths', () => {
  it('lists January to December of the year', () => {
    const months = yearMonths(2026);

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2026, month: 1 });
    expect(months[11]).toEqual({ year: 2026, month: 12 });
  });
});
