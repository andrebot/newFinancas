import { useMemo } from 'react';
import { lineChart } from '../../config/constants';
import useFormatter from '../../utilities/useFormatter';
import { monthTicks } from './lineGeometry';
import {
  LineArt, LoneDot, Marker, PendingMarker, PlotGuides, PointsTable, SelectedGuide, TickLabel,
  ValueReadout,
} from './LineChartParts';
import {
  buildLineModel, rangeOf, type LineModel, type LinePending, type LinePoint, type LineReference,
  type LineShape, type LineTone,
} from './lineModel';
import useLineReadout from './useLineReadout';

// The kit's line chart (K38, OQ-229): net worth, a Holding's market value and
// rate history (mockups 20, 50–53). It is drawn by hand: the line and its fill
// in an SVG stretched over the plot, everything that must keep its shape — a
// marker, a dashed line, a label — in HTML on the same percent coordinates.
//
// It only displays. The caller loads the series, formats each value and date
// (FormattingUtility) and handles an empty one: without anything to draw, it
// renders nothing. For K46 it also draws the point being edited and the value
// about to be saved, but K46 holds that state.
//
// `compact` is the sparkline: the line alone, with no labels, markers or hover.

export type {
  LinePending, LinePoint, LineReference, LineShape, LineTone,
} from './lineModel';

/** The line chart's props. */
export interface LineChartProps {
  /** The values, in any order. */
  readonly points: readonly LinePoint[];
  /** The chart's accessible name, already translated. */
  readonly ariaLabel: string;
  /** Defaults to `sky`. */
  readonly tone?: LineTone | undefined;
  /** Defaults to `history`. */
  readonly shape?: LineShape | undefined;
  /** The sparkline: the line alone, not interactive. */
  readonly compact?: boolean | undefined;
  /** The plot's height, in px; the default depends on `compact`. */
  readonly heightPx?: number | undefined;
  /** Draws dashed background lines (mockup 20). */
  readonly grid?: boolean | undefined;
  /** Marks the lowest and highest values on dashed lines (mockup 53). */
  readonly showRange?: boolean | undefined;
  /** A dashed level with its label, e.g., "invested R$110k" (mockup 52). */
  readonly reference?: LineReference | undefined;
  /** The key of the value being edited: a crosshair and a larger marker. */
  readonly selectedKey?: string | undefined;
  /** The pill above that value, already translated, e.g., "Jul · editing". */
  readonly selectedLabel?: string | undefined;
  /** A value about to be saved. */
  readonly pending?: LinePending | undefined;
  /** Called with a value's key when it is picked; markers are buttons with it. */
  readonly onSelect?: ((key: string) => void) | undefined;
}

const PLOT = [
  'relative touch-pan-y rounded-sm outline-mint',
  'focus-visible:outline-2 focus-visible:outline-offset-4',
].join(' ');

/**
 * Picks the plot's height.
 *
 * @param heightPx - The caller's, if any.
 * @param fallback - The default for this kind of chart.
 * @returns The height, in px.
 */
const plotHeight = (heightPx: number | undefined, fallback: number) => heightPx ?? fallback;

/**
 * Draws the sparkline: the line alone, named as one image.
 *
 * @param props - The drawn series, its name and height.
 * @returns The sparkline.
 */
function Sparkline({ model, ariaLabel, heightPx }: {
  readonly model: LineModel;
  readonly ariaLabel: string;
  readonly heightPx: number | undefined;
}) {
  const lonePoint = model.placed.length === 1 ? model.placed[0] : undefined;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative"
      style={{ height: plotHeight(heightPx, lineChart.compactHeightPx) }}
    >
      <LineArt model={model} />
      {lonePoint && <LoneDot point={lonePoint} fill={model.fill} />}
    </div>
  );
}

/**
 * Draws the month labels under the plot, in the interface language.
 *
 * @param props - The drawn series.
 * @returns The labels.
 */
function MonthLabels({ model }: { readonly model: LineModel }) {
  const formatter = useFormatter();
  return (
    <div aria-hidden className="relative h-3.5">
      {monthTicks(model.dates, model.scales.leftOf).map((tick) => (
        <TickLabel
          key={tick.date}
          left={tick.left}
          label={formatter.date(tick.date, 'monthShort')}
          highlighted={tick.date.slice(0, 7) === model.pendingMonth}
        />
      ))}
    </div>
  );
}

/** The full chart's props: the caller's, with the series already drawn. */
type FullChartProps = LineChartProps & { readonly model: LineModel };

/**
 * Draws the full chart: the plot with its guides and markers, the month labels,
 * and the values for assistive tech.
 *
 * @param props - The drawn series and how to show it.
 * @returns The chart.
 */
function FullChart({
  model, ariaLabel, heightPx, grid, showRange, reference, selectedKey,
  selectedLabel, onSelect,
}: FullChartProps) {
  const { placed, scales, fill } = model;
  const pointOf = (key: string | undefined) => placed.find((point) => point.key === key);

  /**
   * Picks a value from the keyboard, when it can be picked.
   *
   * @param key - The value's key.
   */
  const confirm = (key: string) => {
    if (pointOf(key)?.selectable !== false) {
      onSelect?.(key);
    }
  };
  const marks = useMemo(() => placed.map(({ key, position }) => ({ key, position })), [placed]);
  const { activeKey, plotRef, handlers } = useLineReadout(marks, confirm);
  const active = pointOf(activeKey);
  const selected = pointOf(selectedKey);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={plotRef}
        role="group"
        aria-label={ariaLabel}
        // The plot is one tab stop: the arrows read its values.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={PLOT}
        style={{ height: plotHeight(heightPx, lineChart.defaultHeightPx) }}
        {...handlers}
      >
        <PlotGuides
          grid={grid === true}
          range={showRange === true ? rangeOf(placed) : undefined}
          reference={reference}
          topOf={scales.topOf}
        />
        <LineArt model={model} />
        {selected && !active && (
          <SelectedGuide position={selected.position} label={selectedLabel} />
        )}
        {model.marked.map((point) => (
          <Marker
            key={point.key}
            point={point}
            fill={fill}
            selected={point.key === selectedKey}
            onSelect={onSelect}
          />
        ))}
        {model.pendingPosition && <PendingMarker position={model.pendingPosition} />}
        {active && <ValueReadout point={active} fill={fill} />}
      </div>
      <MonthLabels model={model} />
      <PointsTable caption={ariaLabel} points={placed} />
      <span className="sr-only" aria-live="polite">
        {active && `${active.dateLabel} ${active.valueLabel}`}
      </span>
    </div>
  );
}

/**
 * Draws a line chart: see the top of this file.
 *
 * @param props - The series and how to draw it.
 * @returns The chart, or nothing when there is nothing to draw.
 */
export function LineChart(props: LineChartProps) {
  const {
    points, reference, pending, tone, shape, compact, ariaLabel, heightPx,
  } = props;
  const model = useMemo(
    () => buildLineModel({
      points, reference, pending, tone, shape,
    }),
    [points, reference, pending, tone, shape],
  );
  if (points.length === 0 && pending === undefined) {
    return null;
  }
  return compact === true
    ? <Sparkline model={model} ariaLabel={ariaLabel} heightPx={heightPx} />
    : <FullChart {...props} model={model} />;
}
