import { lineChart } from '../../config/constants';

// The line chart's arithmetic (K38, OQ-229), free of React. Everything is a
// percent of the plot's box: the SVG stretches over a 0–100 box and the HTML
// overlays use the same numbers, so a marker stays round at any width. X is
// proportional to the date, so a long gap between two values looks long; Y
// runs from the lowest value to the highest, never from zero, or a rate moving
// from 10.50 to 10.75 would look flat.

/** Where something sits in the plot, in percent of its width and height. */
export interface PlotPosition {
  /** From the plot's left edge. */
  readonly left: number;
  /** From the plot's top edge. */
  readonly top: number;
}

/** A value on a calendar day. */
export interface DatedValue {
  /** The day, `YYYY-MM-DD`. */
  readonly date: string;
  /** The value, in whatever unit the series uses. */
  readonly value: number;
}

/** The scales that place a series in the plot. */
export interface PlotScales {
  /** Places a day on the X axis. */
  readonly leftOf: (date: string) => number;
  /** Places a value on the Y axis. */
  readonly topOf: (value: number) => number;
}

/** One label under the plot. */
export interface MonthTick {
  /** The day the label stands for: the latest in its month. */
  readonly date: string;
  /** Where it sits on the X axis. */
  readonly left: number;
  /** Whether it names the year: on a long history, the first label and each new year's. */
  readonly showYear: boolean;
}

/**
 * Rounds a coordinate, so the path strings stay short.
 *
 * @param coordinate - The coordinate, in percent.
 * @returns It, to two decimals.
 */
const rounded = (coordinate: number) => Math.round(coordinate * 100) / 100;

/**
 * Sorts a series by day, keeping the caller's order within one day: the last
 * of a day is the one that counts (OQ-167).
 *
 * @param series - The values, in any order.
 * @returns A new, chronological list.
 */
export const chronological = <Item extends { readonly date: string }>(
  series: readonly Item[],
): Item[] => [...series].sort((first, second) => first.date.localeCompare(second.date));

/**
 * Builds the scales for what a chart draws. A single day sits in the middle
 * of the X axis and a flat series in the middle of the Y axis.
 *
 * @param dates - Every day drawn.
 * @param values - Every value drawn, the reference line's included.
 * @returns The two scales.
 */
export const plotScales = (
  dates: readonly string[],
  values: readonly number[],
): PlotScales => {
  const days = dates.map((date) => Date.parse(date));
  const firstDay = Math.min(...days);
  const daySpan = Math.max(...days) - firstDay;
  const lowest = Math.min(...values);
  const valueSpan = Math.max(...values) - lowest;
  const { topInsetPercent, bottomInsetPercent } = lineChart;
  const usableHeight = 100 - topInsetPercent - bottomInsetPercent;
  return {
    leftOf: (date) => (
      daySpan === 0 ? 50 : rounded(((Date.parse(date) - firstDay) / daySpan) * 100)
    ),
    topOf: (value) => (
      valueSpan === 0
        ? 50
        : rounded(topInsetPercent + (1 - (value - lowest) / valueSpan) * usableHeight)
    ),
  };
};

/**
 * Draws straight segments through the positions.
 *
 * @param positions - The positions, left to right.
 * @returns The SVG path, or an empty string for fewer than two.
 */
export const straightPath = (positions: readonly PlotPosition[]): string => (
  positions.length < 2
    ? ''
    : positions
      .map(({ left, top }, index) => `${index === 0 ? 'M' : 'L'}${left},${top}`)
      .join(' ')
);

/**
 * The slope between two neighbouring positions; two on one day count as flat.
 *
 * @param from - The left position.
 * @param to - The right position.
 * @returns The slope.
 */
const slopeBetween = (from: PlotPosition, to: PlotPosition) => {
  const run = to.left - from.left;
  return run === 0 ? 0 : (to.top - from.top) / run;
};

/**
 * The curve's slope at a middle position: flat at a peak or a valley, the
 * harmonic mean of its neighbours otherwise, which is what keeps the curve
 * from overshooting a real value.
 *
 * @param before - The slope arriving at the position.
 * @param after - The slope leaving it.
 * @returns The slope there.
 */
const tangentBetween = (before: number, after: number) => (
  before * after <= 0 ? 0 : (2 * before * after) / (before + after)
);

/**
 * The curve's slope at every position (monotone cubic interpolation).
 *
 * @param positions - The positions, left to right.
 * @returns One slope per position.
 */
const tangentsOf = (positions: readonly PlotPosition[]): number[] => {
  const slopes = positions.slice(1).map((position, index) => (
    slopeBetween(positions[index] as PlotPosition, position)
  ));
  const inner = slopes.slice(1).map((slope, index) => (
    tangentBetween(slopes[index] as number, slope)
  ));
  return [slopes[0] as number, ...inner, slopes[slopes.length - 1] as number];
};

/**
 * Draws a smooth curve through the positions. It is monotone between them, so
 * it never shows a value the series doesn't hold.
 *
 * @param positions - The positions, left to right.
 * @returns The SVG path, or an empty string for fewer than two.
 */
export const smoothPath = (positions: readonly PlotPosition[]): string => {
  if (positions.length < 2) {
    return '';
  }
  const tangents = tangentsOf(positions);
  const segments = positions.slice(1).map((end, index) => {
    const start = positions[index] as PlotPosition;
    const third = (end.left - start.left) / 3;
    const leaving = (tangents[index] as number) * third;
    const arriving = (tangents[index + 1] as number) * third;
    const startControl = `${rounded(start.left + third)},${rounded(start.top + leaving)}`;
    const endControl = `${rounded(end.left - third)},${rounded(end.top - arriving)}`;
    return `C${startControl} ${endControl} ${end.left},${end.top}`;
  });
  const { left, top } = positions[0] as PlotPosition;
  return `M${left},${top} ${segments.join(' ')}`;
};

/**
 * Closes a line down to the plot's bottom edge, for the fill under it.
 *
 * @param line - The line's SVG path.
 * @param positions - The positions the line runs through, left to right.
 * @returns The area's SVG path, or an empty string without a line.
 */
export const areaPath = (line: string, positions: readonly PlotPosition[]): string => {
  if (line === '') {
    return '';
  }
  const { left: firstLeft } = positions[0] as PlotPosition;
  const { left: lastLeft } = positions.at(-1) as PlotPosition;
  return `${line} L${lastLeft},100 L${firstLeft},100 Z`;
};

/**
 * Finds the position closest to a point on the X axis: a reader aims at a
 * date, never at a thin line.
 *
 * @param positions - The positions.
 * @param left - Where the pointer is, in percent of the plot's width.
 * @returns The closest one's index, the latest of a tie, so that of two values on
 * one day it reads the one that counts; -1 with none.
 */
export const nearestIndex = (positions: readonly PlotPosition[], left: number): number => (
  positions.reduce((closest, position, index) => {
    const current = positions[closest];
    return current === undefined
      || Math.abs(position.left - left) <= Math.abs(current.left - left)
      ? index
      : closest;
  }, -1)
);

/**
 * Counts the months from the year zero, to compare two days.
 *
 * @param date - The day, `YYYY-MM-DD`.
 * @returns Its month's number.
 */
const monthNumber = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

/**
 * Marks which labels name the year: none under a year, when no month's name
 * repeats; otherwise the first, and each one that starts a new year.
 *
 * @param ticks - The labels, left to right, without the mark.
 * @param longHistory - Whether the days drawn span a year or more.
 * @returns The labels.
 */
const withYearMarks = (
  ticks: readonly Omit<MonthTick, 'showYear'>[],
  longHistory: boolean,
): MonthTick[] => ticks.map((tick, index) => ({
  ...tick,
  showYear: longHistory && tick.date.slice(0, 4) !== ticks[index - 1]?.date.slice(0, 4),
}));

/**
 * Picks the labels under the plot: one per month, on the month's latest day,
 * from the newest back, skipping any too close to one already kept — so a long
 * history thins out instead of colliding. A required month always keeps its
 * label, and the others make room for it.
 *
 * @param dates - The days drawn, chronological.
 * @param leftOf - The X scale.
 * @param requiredMonths - The months (`YYYY-MM`) that must keep a label.
 * @returns The labels, left to right.
 */
export const monthTicks = (
  dates: readonly string[],
  leftOf: PlotScales['leftOf'],
  requiredMonths: readonly string[] = [],
): MonthTick[] => {
  const latestPerMonth = new Map(dates.map((date) => [date.slice(0, 7), date]));
  const longHistory = monthNumber(dates.at(-1) ?? '') - monthNumber(dates[0] ?? '') >= 12;
  const gap = longHistory ? lineChart.multiYearTickGapPercent : lineChart.minTickGapPercent;
  const requiredLefts = requiredMonths.flatMap((month) => {
    const date = latestPerMonth.get(month);
    return date === undefined ? [] : [leftOf(date)];
  });
  const kept = [...latestPerMonth.entries()].reduceRight<Omit<MonthTick, 'showYear'>[]>(
    (ticks, [month, date]) => {
      const left = leftOf(date);
      const roomy = [...ticks.map((tick) => tick.left), ...requiredLefts]
        .every((other) => Math.abs(other - left) >= gap);
      return roomy || requiredMonths.includes(month) ? [{ date, left }, ...ticks] : ticks;
    },
    [],
  );
  return withYearMarks(kept, longHistory);
};

/**
 * Finds the value a value about to be saved continues from: the last one on or
 * before its day, or the first one after it when it would be the earliest.
 *
 * @param series - The saved values, chronological.
 * @param date - The new value's day.
 * @returns The value to connect it to, if any is saved.
 */
export const pendingAnchor = <Item extends { readonly date: string }>(
  series: readonly Item[],
  date: string,
): Item | undefined => series.filter((item) => item.date <= date).at(-1) ?? series[0];

/**
 * Moves through a series from the keyboard. With nothing active yet, the arrows
 * start at the newest value.
 *
 * @param key - The key pressed.
 * @param current - The active index, or -1.
 * @param count - How many values the series has.
 * @returns The new index, or undefined when the key doesn't move it.
 */
export const steppedIndex = (
  key: string,
  current: number,
  count: number,
): number | undefined => {
  const last = count - 1;
  const steps: Record<string, number> = {
    ArrowLeft: current < 0 ? last : Math.max(current - 1, 0),
    ArrowRight: current < 0 ? last : Math.min(current + 1, last),
    Home: 0,
    End: last,
  };
  return steps[key];
};
