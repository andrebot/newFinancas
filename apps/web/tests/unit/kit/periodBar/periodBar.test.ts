import { describe, expect, it } from 'vitest';
import {
  barHeights, isFuture, periodOf, stepMonth, switchYear,
} from '../../../../src/kit/periodBar/periodBar';

// Kit helpers (BDT: Utility → unit, mocking nothing): pure date and scale reads.

const TODAY = '2026-09-17';

describe('periodOf', () => {
  it('reads the year and month of a date', () => {
    expect(periodOf(TODAY)).toEqual({ year: 2026, month: 9 });
  });
});

describe('isFuture', () => {
  it('holds today\'s month and every one before it as happened', () => {
    expect(isFuture({ year: 2026, month: 9 }, TODAY)).toBe(false);
    expect(isFuture({ year: 2025, month: 12 }, TODAY)).toBe(false);
  });

  it('marks a later month, in this year or the next, as ahead', () => {
    expect(isFuture({ year: 2026, month: 10 }, TODAY)).toBe(true);
    expect(isFuture({ year: 2027, month: 1 }, TODAY)).toBe(true);
  });
});

describe('stepMonth', () => {
  it('moves within a year', () => {
    expect(stepMonth({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 });
    expect(stepMonth({ year: 2026, month: 5 }, -1)).toEqual({ year: 2026, month: 4 });
  });

  it('crosses a year\'s end both ways', () => {
    expect(stepMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
    expect(stepMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('switchYear', () => {
  it('keeps the month', () => {
    expect(switchYear({ year: 2026, month: 3 }, 2025, TODAY)).toEqual({ year: 2025, month: 3 });
  });

  it('holds back to today\'s month when the month would lie ahead', () => {
    expect(switchYear({ year: 2025, month: 11 }, 2026, TODAY)).toEqual({ year: 2026, month: 9 });
  });
});

describe('barHeights', () => {
  it('scales every bar against the year\'s largest figure, in or out', () => {
    const heights = barHeights([
      { month: 1, in: 4000, out: 1000 },
      { month: 2, in: 2000, out: 8000 },
    ]);
    expect(heights.get(1)).toEqual({ in: 50, out: 12.5 });
    expect(heights.get(2)).toEqual({ in: 25, out: 100 });
  });

  it('leaves a month that isn\'t listed out', () => {
    expect(barHeights([{ month: 1, in: 100, out: 0 }]).has(2)).toBe(false);
  });

  it('stands every bar empty in a year with no money moved', () => {
    expect(barHeights([{ month: 1, in: 0, out: 0 }]).get(1)).toEqual({ in: 0, out: 0 });
    expect(barHeights([]).size).toBe(0);
  });

  it('stands a figure below zero as an empty bar', () => {
    expect(barHeights([{ month: 1, in: 500, out: -200 }]).get(1)).toEqual({ in: 100, out: 0 });
  });
});
