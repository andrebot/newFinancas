import { useMemo } from 'react';
import { lineChart } from '../../config/constants';
import useFormatter from '../../utilities/useFormatter';
import { isLongHistory, monthTicks } from './lineGeometry';
import {
  LineArt, LoneDot, Marker, PendingMarker, PlotGuides, PointsTable, SelectedGuide, TickLabel,
  ValueReadout,
} from './LineChartParts';
import {
  buildLineModel, rangeOf, type LineModel, type LinePending, type LinePoint, type LineReference,
  type LineShape, type LineSurface, type LineTone, type PlacedPoint,
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
  LinePending, LinePoint, LineReference, LineShape, LineSurface, LineTone,
} from './lineModel';

/** The line chart's props. */
export interface LineChartProps {
  /**
   * The values, sorted here by day. Within one day keep the order they were
   * saved in: the last is the one that counts (OQ-167), so a list that comes
   * newest first, as the API sends it, must be reversed.
   */
  readonly points: readonly LinePoint[];
  /** The chart's accessible name, already translated. */
  readonly ariaLabel: string;
  /** Defaults to `sky`. */
  readonly tone?: LineTone | undefined;
  /** Defaults to `history`. */
  readonly shape?: LineShape | undefined;
  /** The sparkline: the line alone, not interactive. */
  readonly compact?: boolean | undefined;
  /** What the chart sits on, for its markers' halo. Defaults to `card`. */
  readonly surface?: LineSurface | undefined;
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
  /** Called with a value's key when it is picked: a press in the plot picks what its chip shows. */
  readonly onSelect?: ((key: string) => void) | undefined;
}

const PLOT = [
  'relative touch-pan-y rounded-sm outline-mint',
  'focus-visible:outline-2 focus-visible:outline-offset-4',
].join(' ');

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
      style={{ height: heightPx ?? lineChart.compactHeightPx }}
    >
      <LineArt model={model} />
      {lonePoint && <LoneDot point={lonePoint} fill={model.fill} halo={model.halo} />}
    </div>
  );
}

/**
 * Draws the month labels under the plot, in the interface language: the month
 * of a value being saved or edited in mint, labelled first (the one being saved
 * wins if they would collide), and the newest in its model's colour. From a year
 * of history on, month names repeat, so every label is numeric (09/26).
 *
 * @param props - The drawn series, and the month of the value being edited.
 * @returns The labels.
 */
function MonthLabels({ model, selectedMonth }: {
  readonly model: LineModel;
  readonly selectedMonth: string | undefined;
}) {
  const formatter = useFormatter();
  const highlighted = [model.pendingMonth, selectedMonth].filter((month) => month !== undefined);
  const ticks = monthTicks(model.dates, model.scales.leftOf, highlighted);
  const style = isLongHistory(model.dates) ? 'monthYearNumeric' : 'monthShort';

  /**
   * Picks a label's colour.
   *
   * @param date - The label's day.
   * @param index - Its place among the labels.
   * @returns The colour class.
   */
  const toneOf = (date: string, index: number) => {
    if (highlighted.includes(date.slice(0, 7))) {
      return 'text-mint';
    }
    return index === ticks.length - 1 ? model.latestTickTone : 'text-muted';
  };
  return (
    <div aria-hidden className="relative h-3.5">
      {ticks.map((tick, index) => (
        <TickLabel
          key={tick.date}
          left={tick.left}
          label={formatter.date(tick.date, style)}
          tone={toneOf(tick.date, index)}
        />
      ))}
    </div>
  );
}

/** The full chart's props: the caller's, with the series already drawn. */
type FullChartProps = LineChartProps & { readonly model: LineModel };

/**
 * Builds the rule for picking a value: nothing without a callback, or for a
 * value that can't be picked.
 *
 * @param placed - The values.
 * @param onSelect - The caller's callback, if any.
 * @returns A function that picks a value by key, answering whether it could.
 */
const pickerOf = (
  placed: readonly PlacedPoint[],
  onSelect: LineChartProps['onSelect'],
) => (key: string) => {
  const pickable = onSelect !== undefined
    && placed.find((point) => point.key === key)?.selectable !== false;
  if (pickable) {
    onSelect(key);
  }
  return pickable;
};

/** What the plot draws over its line. */
interface PlotMarksProps {
  readonly model: LineModel;
  readonly active: PlacedPoint | undefined;
  readonly selected: PlacedPoint | undefined;
  readonly selectedLabel: string | undefined;
  readonly pickable: boolean;
  readonly onPick: (key: string) => void;
}

/**
 * Draws what sits over the line: the value being edited, the markers, a pending
 * value and the readout. The editing state stays while any value is read, that
 * one included, but its pill gives way to the chip, which could land on it.
 *
 * @param props - The drawn series and the values to mark.
 * @returns The marks.
 */
function PlotMarks({
  model, active, selected, selectedLabel, pickable, onPick,
}: PlotMarksProps) {
  const { fill, halo } = model;
  return (
    <>
      {selected && (
        <SelectedGuide position={selected.position} label={active ? undefined : selectedLabel} />
      )}
      {model.marked.map((point) => (
        <Marker
          key={point.key}
          point={point}
          fill={fill}
          halo={halo}
          selected={point.key === selected?.key}
          pickable={pickable}
          onPick={onPick}
        />
      ))}
      {model.pendingPosition && <PendingMarker position={model.pendingPosition} />}
      {active && (
        <ValueReadout
          point={active}
          fill={active.key === selected?.key ? 'bg-mint' : fill}
          halo={halo}
        />
      )}
    </>
  );
}

/**
 * Draws the full chart: the plot with its guides and markers, the month labels,
 * and the values for assistive tech.
 *
 * @param props - The drawn series and how to show it.
 * @returns The chart.
 */
function FullChart({
  model, ariaLabel, heightPx, grid, showRange, reference, selectedKey, selectedLabel, onSelect,
}: FullChartProps) {
  const { placed, scales } = model;
  const pickable = onSelect !== undefined;
  const {
    activeKey, plotRef, pick, handlers,
  } = useLineReadout({
    marks: placed, onPick: pickerOf(placed, onSelect), startKey: selectedKey, pickable,
  });
  const active = placed.find((point) => point.key === activeKey);
  const selected = placed.find((point) => point.key === selectedKey);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={plotRef}
        role="group"
        aria-label={ariaLabel}
        // The plot is one tab stop: the arrows read its values.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={pickable ? `${PLOT} cursor-pointer` : PLOT}
        style={{ height: heightPx ?? lineChart.defaultHeightPx }}
        {...handlers}
      >
        <PlotGuides
          grid={grid}
          range={showRange ? rangeOf(placed) : undefined}
          reference={reference}
          topOf={scales.topOf}
        />
        <LineArt model={model} />
        <PlotMarks
          model={model}
          active={active}
          selected={selected}
          selectedLabel={selectedLabel}
          pickable={pickable}
          onPick={pick}
        />
      </div>
      <MonthLabels model={model} selectedMonth={selected?.date.slice(0, 7)} />
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
    points, reference, pending, tone, shape, surface, compact, ariaLabel, heightPx,
  } = props;
  const model = useMemo(
    () => buildLineModel({
      points, reference, pending, tone, shape, surface,
    }),
    [points, reference, pending, tone, shape, surface],
  );
  if (points.length === 0 && pending === undefined) {
    return null;
  }
  return compact === true
    ? <Sparkline model={model} ariaLabel={ariaLabel} heightPx={heightPx} />
    : <FullChart {...props} model={model} />;
}
