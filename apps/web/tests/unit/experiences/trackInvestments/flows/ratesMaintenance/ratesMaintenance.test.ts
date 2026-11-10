import type { IndexRateValue } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  chartWindowOf, comparedStyleOf, holdingsTrackingOf, latestChangeOf, mayChangeRate,
  mayRecordRates, rateEntriesOf, recorderOf, windowStartOf, type RateViewer,
} from '../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/ratesMaintenance';
import { holdingOf } from '../../../portfolioFixtures';

// Rates Maintenance's model (BDT: Flow tier, unit; pure, nothing mocked).

/**
 * Builds an index value.
 *
 * @param id - Its id.
 * @param asOf - Its day.
 * @param value - Percent × 10,000.
 * @param createdByUserId - Who recorded it.
 * @returns The value.
 */
const valueOf = (
  id: string,
  asOf: string,
  value: number,
  createdByUserId: string | null = 'ana',
): IndexRateValue => ({
  id, index: 'selic', value, asOf, createdByUserId, createdAt: `${asOf}T12:00:00Z`,
});

const ANA: RateViewer = { selfUserId: 'ana', role: 'Member' };

describe('mayRecordRates', () => {
  it('lets every member but a Viewer record', () => {
    expect(['Owner', 'Admin', 'Member'].map(mayRecordRates)).toEqual([true, true, true]);
    expect(mayRecordRates('Viewer')).toBe(false);
    expect(mayRecordRates(undefined)).toBe(false);
  });
});

describe('mayChangeRate', () => {
  it('lets an Owner or Admin change any value, a Member only their own', () => {
    const bens = valueOf('v', '2026-09-30', 105000, 'ben');

    expect(mayChangeRate(bens, { selfUserId: 'ana', role: 'Owner' })).toBe(true);
    expect(mayChangeRate(bens, { selfUserId: 'ana', role: 'Admin' })).toBe(true);
    expect(mayChangeRate(bens, ANA)).toBe(false);
    expect(mayChangeRate(valueOf('v', '2026-09-30', 105000), ANA)).toBe(true);
  });

  it('lets no Viewer change a value, even their own, nor a Member a former member\'s', () => {
    expect(mayChangeRate(valueOf('v', '2026-09-30', 1), { selfUserId: 'ana', role: 'Viewer' }))
      .toBe(false);
    expect(mayChangeRate(valueOf('v', '2026-09-30', 1, null), ANA)).toBe(false);
  });
});

describe('recorderOf', () => {
  it('finds a member by first name, else a former member', () => {
    const recorders = [{ userId: 'ben', firstName: 'Ben' }];

    expect(recorderOf('ben', recorders)).toEqual({ kind: 'member', name: 'Ben' });
    expect(recorderOf('gone', recorders)).toEqual({ kind: 'former' });
    expect(recorderOf(null, recorders)).toEqual({ kind: 'former' });
  });

  it('knows no one while the members are unknown', () => {
    expect(recorderOf('ben', undefined)).toEqual({ kind: 'unknown' });
  });
});

describe('comparedStyleOf', () => {
  it('names the day in one month, the month in one year, else the month and year', () => {
    expect(comparedStyleOf('2026-09-30', '2026-09-18')).toBe('dayMonth');
    expect(comparedStyleOf('2026-09-30', '2026-08-31')).toBe('monthShort');
    expect(comparedStyleOf('2026-01-31', '2025-12-31')).toBe('monthShortYear');
  });
});

describe('rateEntriesOf', () => {
  it('keeps the order and locks what the viewer may not change, with why', () => {
    const entries = rateEntriesOf(
      [valueOf('sep', '2026-09-30', 105000), valueOf('aug', '2026-08-31', 107500, 'ben')],
      ANA,
      (userId) => `Added by ${userId ?? 'nobody'}`,
    );

    expect(entries).toEqual([
      {
        key: 'sep', date: '2026-09-30', value: 105000, lockedReason: undefined,
      },
      {
        key: 'aug', date: '2026-08-31', value: 107500, lockedReason: 'Added by ben',
      },
    ]);
  });
});

describe('windowStartOf', () => {
  it('counts whole months back from the newest one, across a year', () => {
    expect(windowStartOf('2026-09-30', 6)).toBe('2026-04-01');
    expect(windowStartOf('2026-02-15', 6)).toBe('2025-09-01');
    expect(windowStartOf('2026-01-01', 1)).toBe('2026-01-01');
    expect(windowStartOf('2026-12-31', 12)).toBe('2026-01-01');
  });
});

describe('chartWindowOf', () => {
  it('keeps the values from the window\'s first day on, newest first', () => {
    const entries = [
      { key: 'sep', date: '2026-09-30', value: 1 },
      { key: 'apr', date: '2026-04-01', value: 2 },
      { key: 'mar', date: '2026-03-31', value: 3 },
    ];

    expect(chartWindowOf(entries, 6).map(({ key }) => key)).toEqual(['sep', 'apr']);
  });

  it('counts from the latest value, however old, and keeps nothing without one', () => {
    const stale = [
      { key: 'old', date: '2024-05-10', value: 1 },
      { key: 'older', date: '2024-01-10', value: 2 },
    ];

    expect(chartWindowOf(stale, 6).map(({ key }) => key)).toEqual(['old', 'older']);
    expect(chartWindowOf([], 6)).toEqual([]);
  });
});

describe('latestChangeOf', () => {
  it('compares the latest value with the one before, by its month', () => {
    expect(latestChangeOf([
      { key: 'sep', date: '2026-09-30', value: 44200 },
      { key: 'aug', date: '2026-08-31', value: 42400 },
    ])).toEqual({ points: 1800, previousDate: '2026-08-31', style: 'monthShort' });
  });

  it('names the day when both fall in one month, and reads unchanged as zero', () => {
    expect(latestChangeOf([
      { key: 'b', date: '2026-09-30', value: 105000 },
      { key: 'a', date: '2026-09-18', value: 105000 },
    ])).toEqual({ points: 0, previousDate: '2026-09-18', style: 'dayMonth' });
  });

  it('has no change with fewer than two values', () => {
    expect(latestChangeOf([{ key: 'a', date: '2026-09-30', value: 1 }])).toBeUndefined();
    expect(latestChangeOf([])).toBeUndefined();
  });
});

describe('holdingsTrackingOf', () => {
  it('lists the active, unmatured Holdings whose rate tracks the index', () => {
    const holdings = [
      holdingOf('selic29', { rate: { type: 'selic', value: 1000000 } }),
      holdingOf('cdb', { rate: { type: 'cdi', value: 1100000 } }),
      holdingOf('gone', {
        rate: { type: 'selic', value: 1000000 }, archivedAt: '2026-01-01T00:00:00Z',
      }),
      holdingOf('due', { rate: { type: 'selic', value: 1000000 }, dueDate: '2026-09-30' }),
      holdingOf('later', { rate: { type: 'selic', value: 1000000 }, dueDate: '2026-10-01' }),
      holdingOf('xpml11'),
    ];

    expect(holdingsTrackingOf(holdings, 'selic', '2026-09-30').map(({ id }) => id))
      .toEqual(['selic29', 'later']);
    expect(holdingsTrackingOf(holdings, 'igpm', '2026-09-30')).toEqual([]);
  });
});
