import { describe, expect, it } from 'vitest';
import { monthOf, monthOrdinal, monthsBetween } from '../../../src/accessors/calendarMonth';

describe('monthOf', () => {
  it('reads the year and month of a calendar date', () => {
    expect(monthOf('2026-03-31')).toEqual({ year: 2026, month: 3 });
  });
});

describe('monthOrdinal', () => {
  it('counts December and the next January one apart', () => {
    const december = monthOrdinal({ year: 2025, month: 12 });

    expect(monthOrdinal({ year: 2026, month: 1 }) - december).toBe(1);
    expect(monthOrdinal({ year: 2026, month: 1 })).toBe(2026 * 12);
  });
});

describe('monthsBetween', () => {
  it('lists every month across a year boundary, both ends included', () => {
    expect(monthsBetween({ year: 2025, month: 11 }, { year: 2026, month: 2 })).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
  });

  it('lists one month when both ends are the same', () => {
    expect(monthsBetween({ year: 2026, month: 5 }, { year: 2026, month: 5 }))
      .toEqual([{ year: 2026, month: 5 }]);
  });

  it('lists nothing when the end is before the start', () => {
    expect(monthsBetween({ year: 2026, month: 5 }, { year: 2026, month: 4 })).toEqual([]);
  });
});
