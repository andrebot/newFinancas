import {
  areaPath, chronological, pendingAnchor, plotScales, smoothPath, straightPath,
  type DatedValue, type PlotPosition, type PlotScales,
} from './lineGeometry';

// What a line chart draws, worked out from the caller's values (K38, OQ-229):
// the points placed on one pair of scales and the paths through them.

/** The series' colour: mint for USD, sky for BRL, the rest for rates and values. */
export type LineTone = 'mint' | 'sky' | 'sun' | 'lilac';

/**
 * The line's shape: `trend` is a smooth curve with its latest point marked
 * (net worth); `history` is straight segments with every saved value marked.
 */
export type LineShape = 'trend' | 'history';

/** One value on the chart. */
export interface LinePoint {
  /** Its stable key, e.g., the snapshot's id. */
  readonly key: string;
  /** The day, `YYYY-MM-DD`; a month's figure uses the month's last day. */
  readonly date: string;
  /** The value, for placing it; a series keeps to one unit. */
  readonly value: number;
  /** The value as the reader sees it, already formatted. */
  readonly valueLabel: string;
  /** The day as the reader sees it, already formatted. */
  readonly dateLabel: string;
  /** False when it can't be picked: a transaction's snapshot (OQ-56). Defaults to true. */
  readonly selectable?: boolean | undefined;
}

/** A level to compare the series against, e.g., what was invested. */
export interface LineReference {
  /** The level, in the series' unit. */
  readonly value: number;
  /** Its label, already formatted and translated. */
  readonly label: string;
}

/** A value about to be saved (K46): a dashed ring and a dashed segment. */
export interface LinePending {
  /** The day, `YYYY-MM-DD`. */
  readonly date: string;
  /** The value, in the series' unit. */
  readonly value: number;
}

/** A point with its place in the plot. */
export interface PlacedPoint extends LinePoint {
  /** Where it sits. */
  readonly position: PlotPosition;
}

/** What the model is built from. */
export interface LineModelInput {
  readonly points: readonly LinePoint[];
  readonly reference: LineReference | undefined;
  readonly pending: LinePending | undefined;
  readonly tone: LineTone | undefined;
  readonly shape: LineShape | undefined;
}

/** What a chart draws. */
export interface LineModel {
  /** The saved values, chronological and placed. */
  readonly placed: readonly PlacedPoint[];
  /** The values that wear a marker: all of them, or a trend's latest. */
  readonly marked: readonly PlacedPoint[];
  /** The scales everything shares. */
  readonly scales: PlotScales;
  /** Every day drawn, chronological. */
  readonly dates: readonly string[];
  /** The line's SVG path. */
  readonly line: string;
  /** The fill's SVG path. */
  readonly area: string;
  /** The pending value's dashed segment. */
  readonly pendingSegment: string;
  /** Where the pending value sits, if there is one. */
  readonly pendingPosition: PlotPosition | undefined;
  /** The pending value's month, `YYYY-MM`, if there is one. */
  readonly pendingMonth: string | undefined;
  /** The series' text colour class, which the SVG draws with. */
  readonly text: string;
  /** The series' fill colour class, for its markers. */
  readonly fill: string;
}

const TONES: Record<LineTone, { readonly text: string; readonly fill: string }> = {
  mint: { text: 'text-mint', fill: 'bg-mint' },
  sky: { text: 'text-sky', fill: 'bg-sky' },
  sun: { text: 'text-sun', fill: 'bg-sun' },
  lilac: { text: 'text-lilac', fill: 'bg-lilac' },
};

/**
 * Finds the lowest and highest values.
 *
 * @param placed - The saved values.
 * @returns The two, the same one twice for a single value; undefined with none.
 */
export const rangeOf = (placed: readonly PlacedPoint[]) => {
  const byValue = [...placed].sort((first, second) => first.value - second.value);
  const [low] = byValue;
  const high = byValue.at(-1);
  return low && high && { low, high };
};

/**
 * Places a value on the scales.
 *
 * @param scales - The chart's scales.
 * @param dated - The value and its day.
 * @returns Where it sits.
 */
const placedAt = (scales: PlotScales, { date, value }: DatedValue): PlotPosition => ({
  left: scales.leftOf(date),
  top: scales.topOf(value),
});

/**
 * Works out how a value about to be saved is drawn: its ring, its month, and
 * the dashed segment from the saved value it continues.
 *
 * @param scales - The chart's scales.
 * @param placed - The saved values, chronological.
 * @param pending - The value about to be saved.
 * @returns Its part of the model.
 */
const pendingParts = (
  scales: PlotScales,
  placed: readonly PlacedPoint[],
  pending: LinePending,
) => {
  const position = placedAt(scales, pending);
  const anchor = pendingAnchor(placed, pending.date);
  return {
    pendingPosition: position,
    pendingMonth: pending.date.slice(0, 7),
    pendingSegment: anchor ? straightPath([anchor.position, position]) : '',
  };
};

/** The model's pending part when no value is about to be saved. */
const NO_PENDING = {
  pendingPosition: undefined,
  pendingMonth: undefined,
  pendingSegment: '',
};

/**
 * Works out what a chart draws, placing everything on one pair of scales: the
 * reference level and a pending value count, so neither falls out of the plot.
 *
 * @param input - The caller's values, level, pending value, tone and shape.
 * @returns What to draw.
 */
export const buildLineModel = ({
  points, reference, pending, tone, shape,
}: LineModelInput): LineModel => {
  const ordered = chronological(points);
  const drawn: readonly DatedValue[] = pending ? [...ordered, pending] : ordered;
  const dates = chronological(drawn).map(({ date }) => date);
  const levels = drawn.map(({ value }) => value);
  const scales = plotScales(dates, reference ? [...levels, reference.value] : levels);
  const placed = ordered.map((point) => ({ ...point, position: placedAt(scales, point) }));
  const positions = placed.map(({ position }) => position);
  const line = (shape === 'trend' ? smoothPath : straightPath)(positions);
  return {
    placed,
    marked: shape === 'trend' ? placed.slice(-1) : placed,
    scales,
    dates,
    line,
    area: areaPath(line, positions),
    ...(pending ? pendingParts(scales, placed, pending) : NO_PENDING),
    ...TONES[tone ?? 'sky'],
  };
};
