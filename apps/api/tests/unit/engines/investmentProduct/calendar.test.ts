import { describe, expect, it } from 'vitest';
import {
  addDays, brazilianHolidays, businessDaysBetween, daysBetween, easterSunday,
  followingBusinessDay, monthsBefore,
} from '../../../../src/engines/investmentProduct/calendar';

describe('addDays and daysBetween', () => {
  it('moves across a month, a year and a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts calendar days, negative when the end is earlier', () => {
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366);
    expect(daysBetween('2025-03-10', '2025-03-01')).toBe(-9);
  });
});

describe('monthsBefore', () => {
  it.each([
    ['2025-05-31', 1, '2025-04-30'],
    ['2025-05-31', 2, '2025-03-31'],
    ['2025-05-31', 3, '2025-02-28'],
    ['2028-03-31', 1, '2028-02-29'],
    ['2027-01-15', 6, '2026-07-15'],
    ['2026-02-10', 26, '2023-12-10'],
  ])('%s back %i months is %s — its day, capped at the month end', (date, months, expected) => {
    expect(monthsBefore(date, months)).toBe(expected);
  });
});

describe('easterSunday', () => {
  it.each([
    [2008, '2008-03-23'],
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2038, '2038-04-25'],
    // The years the formula's rarer branches decide (review B18): a negative
    // epact before its modulo, the 451 correction, and the next century.
    [2014, '2014-04-20'],
    [2033, '2033-04-17'],
    [2049, '2049-04-18'],
    [2076, '2076-04-19'],
    [2100, '2100-03-28'],
    [2106, '2106-04-18'],
  ])('%i is %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe('brazilianHolidays', () => {
  it('has the fixed dates and the Easter-based ones (Carnival, Good Friday, Corpus)', () => {
    expect([...brazilianHolidays(2025)].sort()).toEqual([
      '2025-01-01', '2025-03-03', '2025-03-04', '2025-04-18', '2025-04-21', '2025-05-01',
      '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02', '2025-11-15', '2025-11-20',
      '2025-12-25',
    ]);
  });

  it('adds Black Consciousness Day only from 2024 (Lei 14.759/2023)', () => {
    expect(brazilianHolidays(2023).has('2023-11-20')).toBe(false);
    expect(brazilianHolidays(2024).has('2024-11-20')).toBe(true);
  });
});

describe('businessDaysBetween', () => {
  it.each([
    ['across Carnival 2025', '2025-02-28', '2025-03-07', 3, 5],
    ['across Good Friday and Tiradentes 2026', '2026-04-01', '2026-05-01', 20, 22],
    ['across New Year, two years', '2025-12-30', '2026-01-05', 3, 4],
  ])('counts %s — Brazil skips holidays, the US weekends only', (_case, from, to, brazil, us) => {
    expect(businessDaysBetween(from, to, 'BR')).toBe(brazil);
    expect(businessDaysBetween(from, to, 'US')).toBe(us);
  });

  it('skips Corpus Christi (2027-05-27)', () => {
    expect(businessDaysBetween('2027-05-24', '2027-05-31', 'BR')).toBe(4);
  });

  it('counts the start, not the end', () => {
    expect(businessDaysBetween('2025-03-05', '2025-03-06', 'BR')).toBe(1);
  });

  it('is 0 when the end is not after the start', () => {
    expect(businessDaysBetween('2025-03-05', '2025-03-05', 'BR')).toBe(0);
    expect(businessDaysBetween('2025-03-10', '2025-03-05', 'BR')).toBe(0);
  });
});

describe('followingBusinessDay', () => {
  it.each([
    ['a business day stays', '2025-03-05', 'BR', '2025-03-05'],
    ['a national holiday rolls', '2035-01-01', 'BR', '2035-01-02'],
    ['a weekend into a holiday rolls past both', '2025-11-15', 'BR', '2025-11-17'],
    ['a holiday Friday rolls to Monday', '2026-11-20', 'BR', '2026-11-23'],
    ['Brazil\'s holiday is a US business day', '2026-11-20', 'US', '2026-11-20'],
    ['a US Saturday rolls to Monday', '2026-11-21', 'US', '2026-11-23'],
  ])('%s', (_case, date, market, expected) => {
    expect(followingBusinessDay(date, market as 'BR' | 'US')).toBe(expected);
  });
});
