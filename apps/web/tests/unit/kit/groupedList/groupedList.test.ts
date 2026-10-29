import { describe, expect, it } from 'vitest';
import { groupByMonthAndDay } from '../../../../src/kit/groupedList/groupedList';

// Pure helper (BDT: Utility → unit, nothing mocked).

/** An item with an id and a date. */
interface Row {
  readonly id: string;
  readonly date: string;
}

const dateOf = (row: Row) => row.date;

describe('groupByMonthAndDay', () => {
  it('returns no months for no items', () => {
    expect(groupByMonthAndDay([], dateOf)).toEqual([]);
  });

  it('groups items under their month, then their day, keeping their order', () => {
    const rows: Row[] = [
      { id: 'a', date: '2026-09-12' },
      { id: 'b', date: '2026-09-12' },
      { id: 'c', date: '2026-09-01' },
      { id: 'd', date: '2026-08-31' },
    ];
    expect(groupByMonthAndDay(rows, dateOf)).toEqual([
      {
        month: '2026-09',
        days: [
          { date: '2026-09-12', items: [rows[0], rows[1]] },
          { date: '2026-09-01', items: [rows[2]] },
        ],
      },
      { month: '2026-08', days: [{ date: '2026-08-31', items: [rows[3]] }] },
    ]);
  });

  it('starts a new group whenever the date changes, following the given order', () => {
    const rows: Row[] = [
      { id: 'a', date: '2026-09-01' },
      { id: 'b', date: '2026-08-01' },
      { id: 'c', date: '2026-09-01' },
    ];
    expect(groupByMonthAndDay(rows, dateOf).map((month) => month.month))
      .toEqual(['2026-09', '2026-08', '2026-09']);
  });
});
