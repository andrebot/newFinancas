import { describe, expect, it } from 'vitest';
import { lineChart } from '../../../../src/config/constants';
import {
  areaPath, chronological, monthTicks, nearestIndex, pendingAnchor, plotScales, smoothPath,
  steppedIndex, straightPath, type PlotPosition,
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

  it('copes with two values on one day', () => {
    const path = smoothPath([{ left: 0, top: 80 }, { left: 0, top: 40 }, { left: 100, top: 20 }]);
    expect(path).not.toContain('NaN');
    expect(path).not.toContain('Infinity');
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
    expect(areaPath('M0,0', [])).toBe('');
  });
});

describe('nearestIndex', () => {
  const positions = [{ left: 0, top: 1 }, { left: 40, top: 1 }, { left: 100, top: 1 }];

  it('finds the closest position on the X axis', () => {
    expect(nearestIndex(positions, 55)).toBe(1);
    expect(nearestIndex(positions, 90)).toBe(2);
  });

  it('takes the earliest of a tie', () => {
    expect(nearestIndex(positions, 20)).toBe(0);
  });

  it('answers -1 with no positions', () => {
    expect(nearestIndex([], 20)).toBe(-1);
  });
});

describe('monthTicks', () => {
  it('gives one label per month, on its latest day', () => {
    const dates = ['2026-01-05', '2026-01-25', '2026-06-30'];
    const { leftOf } = plotScales(dates, [1]);
    expect(monthTicks(dates, leftOf).map(({ date }) => date)).toEqual(['2026-01-25', '2026-06-30']);
  });

  it('skips a label too close to the next, keeping the newest', () => {
    const dates = ['2026-01-31', '2026-02-01', '2026-12-31'];
    const { leftOf } = plotScales(dates, [1]);
    expect(monthTicks(dates, leftOf).map(({ date }) => date)).toEqual(['2026-02-01', '2026-12-31']);
  });

  it('thins a long history, so no two labels collide', () => {
    const dates = Array.from({ length: 60 }, (_, index) => {
      const month = String((index % 12) + 1).padStart(2, '0');
      return `${2020 + Math.floor(index / 12)}-${month}-15`;
    });
    const { leftOf } = plotScales(dates, [1]);
    const ticks = monthTicks(dates, leftOf);
    expect(ticks.length).toBeLessThanOrEqual(Math.ceil(100 / lineChart.minTickGapPercent) + 1);
    expect(ticks.at(-1)?.date).toBe('2024-12-15');
  });
});

describe('pendingAnchor', () => {
  const series = [{ date: '2026-03-31' }, { date: '2026-05-31' }];

  it('continues from the last value on or before its day', () => {
    expect(pendingAnchor(series, '2026-09-30')).toBe(series[1]);
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
