import { describe, expect, it } from 'vitest';
import { comingDueRowsOf, dueInOf } from '../../../src/experiences/comingDue';
import { HOLDINGS, OVERVIEW } from './portfolioFixtures';

// What Coming Due shows of each Holding (BDT: pure helpers, unit, nothing mocked).

describe('dueInOf', () => {
  it('counts the months while the date is soon', () => {
    expect(dueInOf('2026-12-15', '2026-09-20')).toEqual({ when: 'soon', months: 3 });
    expect(dueInOf('2026-10-01', '2026-09-30')).toEqual({ when: 'soon', months: 1 });
  });

  it('is this month for a date within it, today included', () => {
    expect(dueInOf('2026-09-30', '2026-09-01')).toEqual({ when: 'soon', months: 0 });
    expect(dueInOf('2026-09-20', '2026-09-20')).toEqual({ when: 'soon', months: 0 });
  });

  it('is overdue once the date has passed, even earlier this month', () => {
    expect(dueInOf('2026-08-15', '2026-09-01')).toEqual({ when: 'overdue' });
    expect(dueInOf('2026-09-19', '2026-09-20')).toEqual({ when: 'overdue' });
  });

  it('names the year once it is further off', () => {
    expect(dueInOf('2027-01-15', '2026-09-20')).toEqual({ when: 'later', year: '2027' });
  });
});

describe('comingDueRowsOf', () => {
  it('puts the soonest first, each with its type', () => {
    const rows = comingDueRowsOf(OVERVIEW.comingDue, HOLDINGS, '2026-09-20');
    expect(rows.map((row) => [row.entry.holdingId, row.assetType])).toEqual([
      ['cd', 'cd'],
      ['ipca35', 'tesouro_direto'],
    ]);
  });

  it('leaves the type unknown when the Holdings list lacks it', () => {
    const [row] = comingDueRowsOf([OVERVIEW.comingDue[0]!], [], '2026-09-20');
    expect(row?.assetType).toBeUndefined();
  });

  it('leaves the report untouched', () => {
    comingDueRowsOf(OVERVIEW.comingDue, HOLDINGS, '2026-09-20');
    expect(OVERVIEW.comingDue[0]!.holdingId).toBe('ipca35');
  });
});
