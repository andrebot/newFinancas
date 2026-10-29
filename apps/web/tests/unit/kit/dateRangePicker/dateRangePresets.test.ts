import { describe, expect, it } from 'vitest';
import {
  addDays, choosePreset, editDate, resolvePreset, type DateRangeValue,
} from '../../../../src/kit/dateRangePicker/dateRangePresets';

// Pure helpers of the date range picker (BDT: Interaction tier → unit, no mocks).

const TODAY = '2026-10-29';
const CUSTOM: DateRangeValue = { preset: 'custom', from: '2026-07-03', to: '2026-10-01' };

describe('addDays', () => {
  it.each([
    ['2026-10-29', 0, '2026-10-29'],
    ['2026-10-29', -29, '2026-09-30'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2024-03-01', -1, '2024-02-29'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-12-31', 1, '2027-01-01'],
  ])('moves %s by %i days to %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe('resolvePreset', () => {
  it.each([
    ['anyTime', '', ''],
    ['thisMonth', '2026-10-01', TODAY],
    ['last30Days', '2026-09-30', TODAY],
    ['last90Days', '2026-08-01', TODAY],
    ['thisYear', '2026-01-01', TODAY],
  ] as const)('resolves %s to %j … %j, today included', (preset, from, to) => {
    expect(resolvePreset(preset, TODAY)).toEqual({ from, to });
  });

  it('covers only today on the first of the month and of the year', () => {
    const newYear = { from: '2026-01-01', to: '2026-01-01' };

    expect(resolvePreset('thisMonth', '2026-01-01')).toEqual(newYear);
    expect(resolvePreset('thisYear', '2026-01-01')).toEqual(newYear);
  });
});

describe('choosePreset', () => {
  it('brings a relative preset’s dates', () => {
    expect(choosePreset(CUSTOM, 'last30Days', TODAY))
      .toEqual({ preset: 'last30Days', from: '2026-09-30', to: TODAY });
  });

  it('keeps the dates shown when Custom is chosen', () => {
    const current: DateRangeValue = { preset: 'thisYear', from: '2026-01-01', to: TODAY };

    expect(choosePreset(current, 'custom', TODAY))
      .toEqual({ preset: 'custom', from: '2026-01-01', to: TODAY });
  });
});

describe('editDate', () => {
  it('changes the typed end and switches to Custom', () => {
    const current: DateRangeValue = { preset: 'last90Days', from: '2026-08-01', to: TODAY };

    expect(editDate(current, 'from', '2026-08-15'))
      .toEqual({ preset: 'custom', from: '2026-08-15', to: TODAY });
    expect(editDate(current, 'to', '-0-14'))
      .toEqual({ preset: 'custom', from: '2026-08-01', to: '-0-14' });
  });
});
