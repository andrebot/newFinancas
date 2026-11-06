import { describe, expect, it } from 'vitest';
import { lineChart } from '../../../../src/config/constants';
import {
  areaPath, chronological, isLongHistory, monthTicks, nearestIndex, pendingAnchor, plotScales,
  smoothPath, steppedIndex, straightPath, type PlotPosition,
} from '../../../../src/kit/lineChart/lineGeometry';

// The chart's arithmetic (BDT: pure functions → unit, nothing mocked).

const { topInsetPercent, bottomInsetPercent } = lineChart;

/**
 * Reads a cubic path's end points and control points, so a test can sample it.
 *
 * @param path - The SVG path.
 * @returns Every number in it, in order.
 */
const numbersIn = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

/**
 * Evaluates one coordinate of a cubic Bézier.
 *
 * @param coordinates - The four coordinates.
 * @param along - How far along, 0–1.
 * @returns The coordinate there.
 */
const bezierAt = (
  [start, firstControl, secondControl, end]: readonly [number, number, number, number],
  along: number,
) => {
  const rest = 1 - along;
  return rest ** 3 * start
    + 3 * rest ** 2 * along * firstControl
    + 3 * rest * along ** 2 * secondControl
    + along ** 3 * end;
};

/**
 * Samples a smooth path's Y coordinate along every segment.
 *
 * @param positions - What the path runs through.
 * @returns The sampled tops.
 */
const sampledTops = (positions: readonly PlotPosition[]) => {
  const numbers = numbersIn(smoothPath(positions));
  const tops: number[] = [];
  for (let segment = 0; segment < positions.length - 1; segment += 1) {
    const base = 2 + segment * 6;
    const curve = [
      numbers[base - 1], numbers[base + 1], numbers[base + 3], numbers[base + 5],
    ] as [number, number, number, number];
    for (let step = 0; step <= 20; step += 1) {
      tops.push(bezierAt(curve, step / 20));
    }
  }
  return tops;
};

describe('chronological', () => {
  it('sorts by day without touching the original', () => {
    const series = [{ date: '2026-09-30' }, { date: '2026-04-30' }];
    expect(chronological(series).map(({ date }) => date)).toEqual(['2026-04-30', '2026-09-30']);
    expect(series[0]?.date).toBe('2026-09-30');
  });
});

describe('plotScales', () => {
  it('places days in proportion to the time between them', () => {
    const { leftOf } = plotScales(['2026-01-01', '2026-01-11', '2026-01-31'], [1, 2]);
    expect(leftOf('2026-01-01')).toBe(0);
    expect(leftOf('2026-01-11')).toBeCloseTo(33.33, 2);
    expect(leftOf('2026-01-31')).toBe(100);
  });

  it('keeps a single day in the middle', () => {
    expect(plotScales(['2026-01-01'], [1, 2]).leftOf('2026-01-01')).toBe(50);
  });

  it('runs from the lowest value to the highest, inside the insets', () => {
    const { topOf } = plotScales(['2026-01-01'], [10.5, 10.75]);
    expect(topOf(10.75)).toBe(topInsetPercent);
    expect(topOf(10.5)).toBe(100 - bottomInsetPercent);
  });

  it('keeps a flat series in the middle', () => {
    expect(plotScales(['2026-01-01'], [7, 7]).topOf(7)).toBe(50);
  });
});

describe('straightPath', () => {
  it('joins the positions with segments', () => {
    expect(straightPath([{ left: 0, top: 10 }, { left: 50, top: 20 }, { left: 100, top: 5 }]))
      .toBe('M0,10 L50,20 L100,5');
  });

  it('draws nothing for a lone position', () => {
    expect(straightPath([{ left: 0, top: 10 }])).toBe('');
  });
});

describe('smoothPath', () => {
  it('draws nothing for a lone position', () => {
    expect(smoothPath([{ left: 0, top: 10 }])).toBe('');
  });

  it('runs through every position', () => {
    const path = smoothPath([{ left: 0, top: 80 }, { left: 50, top: 40 }, { left: 100, top: 20 }]);
    expect(path.startsWith('M0,80 C')).toBe(true);
    expect(path).toContain(' 50,40 C');
    expect(path.endsWith(' 100,20')).toBe(true);
  });

  it('never overshoots a peak or a valley', () => {
    const positions = [
      { left: 0, top: 80 }, { left: 10, top: 20 }, { left: 60, top: 70 }, { left: 100, top: 30 },
    ];
    const tops = sampledTops(positions);
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...tops)).toBeLessThanOrEqual(80);
  });

  it('stays monotone on a steadily rising series with uneven gaps', () => {
    const tops = sampledTops([
      { left: 0, top: 90 }, { left: 5, top: 85 }, { left: 80, top: 30 }, { left: 100, top: 10 },
    ]);
    tops.slice(1).forEach((top, index) => {
      expect(top).toBeLessThanOrEqual((tops[index] as number) + 0.02);
    });
  });

  it('takes the harmonic mean of the slopes at a middle position', () => {
    expect(smoothPath([{ left: 0, top: 90 }, { left: 30, top: 60 }, { left: 90, top: 30 }]))
      .toBe('M0,90 C10,80 20,66.67 30,60 C50,46.67 70,40 90,30');
  });

  it('uses the slopes themselves, whatever their size', () => {
    expect(smoothPath([{ left: 0, top: 90 }, { left: 20, top: 50 }, { left: 80, top: 20 }]))
      .toBe('M0,90 C6.67,76.67 13.33,55.33 20,50 C40,34 60,30 80,20');
  });

  it('stays flat over a flat series', () => {
    expect(smoothPath([{ left: 0, top: 50 }, { left: 50, top: 50 }, { left: 100, top: 50 }]))
      .toBe('M0,50 C16.67,50 33.33,50 50,50 C66.67,50 83.33,50 100,50');
  });

  it('curves between just two positions', () => {
    expect(smoothPath([{ left: 0, top: 90 }, { left: 30, top: 60 }]))
      .toBe('M0,90 C10,80 20,70 30,60');
  });

  it('lies flat at a peak', () => {
    expect(smoothPath([{ left: 0, top: 80 }, { left: 50, top: 20 }, { left: 100, top: 60 }]))
      .toBe('M0,80 C16.67,60 33.33,20 50,20 C66.67,20 83.33,46.67 100,60');
  });

  it('counts two values on one day as flat', () => {
    expect(smoothPath([{ left: 0, top: 80 }, { left: 0, top: 40 }, { left: 100, top: 20 }]))
      .toBe('M0,80 C0,80 0,40 0,40 C33.33,40 66.67,26.67 100,20');
  });
});

describe('areaPath', () => {
  it('closes the line down to the bottom edge', () => {
    expect(areaPath('M0,10 L100,5', [{ left: 0, top: 10 }, { left: 100, top: 5 }]))
      .toBe('M0,10 L100,5 L100,100 L0,100 Z');
  });

  it('draws nothing without a line', () => {
    expect(areaPath('', [{ left: 50, top: 50 }])).toBe('');
    expect(areaPath('', [])).toBe('');
  });
});

describe('nearestIndex', () => {
  const positions = [{ left: 0, top: 1 }, { left: 40, top: 1 }, { left: 100, top: 1 }];

  it('finds the closest position on the X axis', () => {
    expect(nearestIndex(positions, 55)).toBe(1);
    expect(nearestIndex(positions, 90)).toBe(2);
  });

  it('takes the latest of a tie', () => {
    expect(nearestIndex(positions, 20)).toBe(1);
  });

  it('reads the last of two values on one day, the one that counts', () => {
    expect(nearestIndex([{ left: 0, top: 1 }, { left: 100, top: 1 }, { left: 100, top: 9 }], 95))
      .toBe(2);
  });

  it('answers -1 with no positions', () => {
    expect(nearestIndex([], 20)).toBe(-1);
  });
});

describe('monthTicks', () => {
  /**
   * Lists the days of a series' labels.
   *
   * @param dates - The days drawn.
   * @param required - The months that must keep a label.
   * @returns The labels' days.
   */
  const tickDates = (dates: readonly string[], required?: readonly string[]) => (
    monthTicks(dates, plotScales(dates, [1]).leftOf, required).map(({ date }) => date)
  );

  /**
   * Builds a monthly series.
   *
   * @param count - How many months, from January 2020.
   * @returns The days.
   */
  const monthly = (count: number) => Array.from({ length: count }, (_, index) => {
    const month = String((index % 12) + 1).padStart(2, '0');
    return `${2020 + Math.floor(index / 12)}-${month}-15`;
  });

  it('has no labels without days', () => {
    expect(tickDates([])).toEqual([]);
  });

  it('gives a month one label, on its latest day', () => {
    expect(tickDates(['2026-01-01', '2026-01-31'])).toEqual(['2026-01-31']);
  });

  it('skips a label too close to the next, keeping the newest', () => {
    expect(tickDates(['2026-01-31', '2026-02-01', '2026-12-31']))
      .toEqual(['2026-02-01', '2026-12-31']);
  });

  it('keeps a label exactly the minimum gap away', () => {
    const left = (date: string) => ({ '2026-01-15': 88, '2026-02-15': 100 }[date] as number);
    const ticks = monthTicks(['2026-01-15', '2026-02-15'], left);
    expect(ticks.map((tick) => tick.left)).toEqual([88, 100]);
  });

  it('thins a long history with the wider gap', () => {
    const dates = monthly(60);
    const { leftOf } = plotScales(dates, [1]);
    const ticks = monthTicks(dates, leftOf);
    expect(ticks.at(-1)?.date).toBe('2024-12-15');
    ticks.slice(1).forEach((tick, index) => {
      const gap = tick.left - (ticks[index] as { readonly left: number }).left;
      expect(gap).toBeGreaterThanOrEqual(lineChart.multiYearTickGapPercent);
    });
  });

  it('keeps a required month, the others making room', () => {
    const dates = monthly(12);
    const ticks = tickDates(dates, ['2020-03']);
    expect(ticks).toContain('2020-03-15');
    const { leftOf } = plotScales(dates, [1]);
    ticks.filter((date) => date !== '2020-03-15').forEach((date) => {
      expect(Math.abs(leftOf(date) - leftOf('2020-03-15')))
        .toBeGreaterThanOrEqual(lineChart.minTickGapPercent);
    });
  });

  it('gives a required month one label, in order from left to right', () => {
    const ticks = tickDates(monthly(6), ['2020-03']);
    expect(ticks.filter((date) => date === '2020-03-15')).toHaveLength(1);
    expect(ticks).toEqual([...ticks].sort());
  });

  it('keeps the first of two required months that would collide', () => {
    const ticks = tickDates(monthly(36), ['2021-11', '2021-10']);
    expect(ticks).toContain('2021-11-15');
    expect(ticks).not.toContain('2021-10-15');
  });

  it('keeps both required months when they fit', () => {
    const ticks = tickDates(monthly(36), ['2021-11', '2021-01']);
    expect(ticks).toContain('2021-11-15');
    expect(ticks).toContain('2021-01-15');
  });

  it('ignores a required month with no label to keep', () => {
    expect(tickDates(['2026-01-31'], ['2030-01'])).toEqual(['2026-01-31']);
  });
});

describe('isLongHistory', () => {
  it('starts at twelve months between the first and last month', () => {
    expect(isLongHistory(['2025-01-31', '2025-12-31'])).toBe(false);
    expect(isLongHistory(['2025-01-31', '2026-01-01'])).toBe(true);
  });

  it('counts months, not the change of year', () => {
    expect(isLongHistory(['2025-11-30', '2026-10-31'])).toBe(false);
  });

  it('is short with no days', () => {
    expect(isLongHistory([])).toBe(false);
  });
});

describe('pendingAnchor', () => {
  const series = [{ date: '2026-03-31' }, { date: '2026-05-31' }, { date: '2026-07-31' }];

  it('continues from the last value on or before its day', () => {
    expect(pendingAnchor(series, '2026-09-30')).toBe(series[2]);
    expect(pendingAnchor(series, '2026-06-01')).toBe(series[1]);
    expect(pendingAnchor(series, '2026-04-15')).toBe(series[0]);
    expect(pendingAnchor(series, '2026-05-31')).toBe(series[1]);
  });

  it('joins the first value when it would be the earliest', () => {
    expect(pendingAnchor(series, '2026-01-01')).toBe(series[0]);
  });

  it('has nothing to join on an empty series', () => {
    expect(pendingAnchor([], '2026-01-01')).toBeUndefined();
  });
});

describe('steppedIndex', () => {
  it('moves one value along and stops at the ends', () => {
    expect(steppedIndex('ArrowLeft', 2, 5)).toBe(1);
    expect(steppedIndex('ArrowRight', 2, 5)).toBe(3);
    expect(steppedIndex('ArrowLeft', 0, 5)).toBe(0);
    expect(steppedIndex('ArrowRight', 4, 5)).toBe(4);
    expect(steppedIndex('ArrowRight', 0, 5)).toBe(1);
  });

  it('starts the arrows at the newest value with nothing active', () => {
    expect(steppedIndex('ArrowLeft', -1, 5)).toBe(4);
    expect(steppedIndex('ArrowRight', -1, 5)).toBe(4);
  });

  it('jumps to the ends', () => {
    expect(steppedIndex('Home', 2, 5)).toBe(0);
    expect(steppedIndex('End', 2, 5)).toBe(4);
  });

  it('ignores any other key', () => {
    expect(steppedIndex('a', 2, 5)).toBeUndefined();
  });
});
