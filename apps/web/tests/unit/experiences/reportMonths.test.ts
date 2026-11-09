import { describe, expect, it } from 'vitest';
import {
  monthEnd, monthOfDate, monthsEndingAt, shiftMonth,
} from '../../../src/experiences/reportMonths';

// The reports' calendar months (BDT: pure helpers, unit, nothing mocked).

describe('monthOfDate', () => {
  it('keeps the year and month of a day', () => {
    expect(monthOfDate('2026-09-30')).toBe('2026-09');
  });
});

describe('shiftMonth', () => {
  it('moves within a year', () => {
    expect(shiftMonth('2026-09', -1)).toBe('2026-08');
    expect(shiftMonth('2026-09', 2)).toBe('2026-11');
  });

  it('crosses into the previous year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-03', -15)).toBe('2024-12');
  });

  it('crosses into the next year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('monthEnd', () => {
  it('finds a 30- and a 31-day month\'s last day', () => {
    expect(monthEnd('2026-09')).toBe('2026-09-30');
    expect(monthEnd('2026-12')).toBe('2026-12-31');
  });

  it('knows a leap February', () => {
    expect(monthEnd('2028-02')).toBe('2028-02-29');
    expect(monthEnd('2026-02')).toBe('2026-02-28');
  });
});

describe('monthsEndingAt', () => {
  it('lists the window oldest first, ending at the month', () => {
    expect(monthsEndingAt('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('is the month alone for a window of one', () => {
    expect(monthsEndingAt('2026-02', 1)).toEqual(['2026-02']);
  });
});
