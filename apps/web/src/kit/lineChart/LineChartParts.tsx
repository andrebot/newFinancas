import { useId, type CSSProperties } from 'react';
import { lineChart } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import type { PlotPosition, PlotScales } from './lineGeometry';
import type {
  LineModel, LineReference, PlacedPoint, rangeOf,
} from './lineModel';

// The pieces a line chart is drawn from (K38, OQ-229). Only `LineArt` is SVG:
// everything that must keep its shape however the plot stretches is HTML on the
// same percent coordinates.

const HAIRLINE = 'pointer-events-none absolute inset-x-0 border-t border-dashed';
const CROSSHAIR = 'pointer-events-none absolute inset-y-0 border-l border-dashed';
const DOT = 'block rounded-full border-2 border-card';
const FLOATING_LABEL = 'pointer-events-none absolute z-10 whitespace-nowrap type-caption';
const RANGE_LABEL = 'absolute left-0 type-micro text-faint tabular-nums';
const TICK = 'absolute type-label whitespace-nowrap';
const PENDING_RING = [
  'pointer-events-none absolute size-3 rounded-full',
  'border-2 border-dashed border-mint',
].join(' ');
const READOUT_CHIP = [
  `${FLOATING_LABEL} rounded-lg bg-ink px-2 py-1`,
  'font-medium text-bg shadow-overlay',
].join(' ');
const SELECTED_PILL = [
  `${FLOATING_LABEL} rounded-full bg-mintdeep`,
  'px-2.5 py-0.5 font-semibold text-mint',
].join(' ');

/**
 * Places an element on a position, centred on it.
 *
 * @param position - Where it goes.
 * @returns The style that centres it there.
 */
const centredOn = ({ left, top }: PlotPosition): CSSProperties => ({
  left: `${left}%`,
  top: `${top}%`,
  transform: 'translate(-50%, -50%)',
});

/**
 * Places a label along the X axis so it stays inside the plot: flush with the
 * side near an edge, centred anywhere else.
 *
 * @param left - Where its point sits, in percent.
 * @returns The style for its horizontal place.
 */
export const horizontallyInside = (left: number): CSSProperties => {
  const { edgeLabelPercent } = lineChart;
  if (left < edgeLabelPercent) {
    return { left: `${left}%` };
  }
  return left > 100 - edgeLabelPercent
    ? { left: `${left}%`, transform: 'translateX(-100%)' }
    : { left: `${left}%`, transform: 'translateX(-50%)' };
};

/** What one marker needs. */
interface MarkerProps {
  readonly point: PlacedPoint;
  readonly fill: string;
  readonly selected: boolean;
  readonly onSelect: ((key: string) => void) | undefined;
}

/**
 * Draws one marker: a button when it can be picked, with a hit area larger
 * than the dot, and out of the tab order — the plot is the one tab stop, and
 * Enter there picks the value the arrows reached.
 *
 * @param props - The point, its colour, whether it's selected and the callback.
 * @returns The marker.
 */
export function Marker({
  point, fill, selected, onSelect,
}: MarkerProps) {
  const dot = <span className={selected ? `${DOT} size-4 bg-mint` : `${DOT} size-3 ${fill}`} />;
  if (onSelect === undefined || point.selectable === false) {
    return (
      <span aria-hidden className="pointer-events-none absolute" style={centredOn(point.position)}>
        {dot}
      </span>
    );
  }
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${point.dateLabel} ${point.valueLabel}`}
      aria-current={selected}
      className="absolute grid size-6 cursor-pointer place-items-center rounded-full"
      style={centredOn(point.position)}
      onClick={() => onSelect(point.key)}
    >
      {dot}
    </button>
  );
}

/**
 * Draws a sparkline's only value, which has no line to show it.
 *
 * @param props - The point and its colour.
 * @returns The dot.
 */
export function LoneDot({ point, fill }: { readonly point: PlacedPoint; readonly fill: string }) {
  return (
    <span className="absolute" style={centredOn(point.position)}>
      <span className={`${DOT} size-3 ${fill}`} />
    </span>
  );
}

/**
 * Draws the value about to be saved: a dashed ring.
 *
 * @param props - Where it sits.
 * @returns The ring.
 */
export function PendingMarker({ position }: { readonly position: PlotPosition }) {
  return (
    <span
      data-testid="line-chart-pending"
      className={PENDING_RING}
      style={centredOn(position)}
    />
  );
}

/**
 * Draws the line, its fill and a pending value's dashed segment, stretched
 * over the plot; the strokes keep their width however it stretches.
 *
 * @param props - The drawn series.
 * @returns The SVG.
 */
export function LineArt({ model }: { readonly model: LineModel }) {
  const gradientId = useId();
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 size-full overflow-visible ${model.text}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={model.area} fill={`url(#${gradientId})`} />
      <path
        d={model.line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={model.pendingSegment}
        fill="none"
        className="stroke-mint"
        strokeWidth="2"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** What the plot's background needs. */
interface PlotGuidesProps {
  readonly grid: boolean;
  readonly range: ReturnType<typeof rangeOf> | undefined;
  readonly reference: LineReference | undefined;
  readonly topOf: PlotScales['topOf'];
}

/**
 * Draws the range's two levels and their labels. A flat series has one level,
 * so it gets one label.
 *
 * @param props - The lowest and highest values.
 * @returns The levels.
 */
function RangeGuides({ low, high }: { readonly low: PlacedPoint; readonly high: PlacedPoint }) {
  return (
    <>
      <span className={`${HAIRLINE} border-line`} style={{ top: `${high.position.top}%` }} />
      <span className={`${HAIRLINE} border-line`} style={{ top: `${low.position.top}%` }} />
      <span className={`${RANGE_LABEL} top-0`}>{high.valueLabel}</span>
      {low.value !== high.value && (
        <span className={`${RANGE_LABEL} bottom-0`}>{low.valueLabel}</span>
      )}
    </>
  );
}

/**
 * Draws the plot's background: the grid, the range and the reference level.
 *
 * @param props - What to draw, and the Y scale.
 * @returns The lines.
 */
export function PlotGuides({
  grid, range, reference, topOf,
}: PlotGuidesProps) {
  return (
    <>
      {grid && lineChart.gridlineTopsPercent.map((top) => (
        <span key={top} className={`${HAIRLINE} border-line`} style={{ top: `${top}%` }} />
      ))}
      {range && <RangeGuides low={range.low} high={range.high} />}
      {reference && (
        <span className={`${HAIRLINE} border-faint`} style={{ top: `${topOf(reference.value)}%` }}>
          <span className="absolute bottom-0.5 left-1 type-caption whitespace-nowrap text-faint">
            {reference.label}
          </span>
        </span>
      )}
    </>
  );
}

/**
 * Draws the value being read: a crosshair, its dot and a chip with the date and
 * the value. The chip sits in the half of the plot away from the point, so it
 * doesn't cover it. It is K24's look, but touch shows it too.
 *
 * @param props - The point, and the series' fill class.
 * @returns The readout.
 */
export function ValueReadout({ point, fill }: {
  readonly point: PlacedPoint;
  readonly fill: string;
}) {
  const { left, top } = point.position;
  return (
    <>
      <span className={`${CROSSHAIR} border-faint`} style={{ left: `${left}%` }} />
      <span aria-hidden className="pointer-events-none absolute" style={centredOn(point.position)}>
        <span className={`${DOT} size-3 ${fill}`} />
      </span>
      <span
        aria-hidden
        data-testid="line-chart-readout"
        className={READOUT_CHIP}
        style={{ ...horizontallyInside(left), ...(top < 50 ? { bottom: 0 } : { top: 0 }) }}
      >
        <span className="block font-normal">{point.dateLabel}</span>
        <span className="block tabular-nums">{point.valueLabel}</span>
      </span>
    </>
  );
}

/**
 * Draws the value being edited's crosshair and its pill. The pill tops the
 * crosshair (mockup 52), unless the value is so high it would cover it.
 *
 * @param props - The value's position, and the pill's text.
 * @returns The crosshair.
 */
export function SelectedGuide({ position, label }: {
  readonly position: PlotPosition;
  readonly label: string | undefined;
}) {
  const { left, top } = position;
  const verticalPlace = top < lineChart.pillClearancePercent ? { bottom: 0 } : { top: 0 };
  return (
    <>
      <span className={`${CROSSHAIR} border-mint`} style={{ left: `${left}%` }} />
      {label !== undefined && (
        <span
          className={SELECTED_PILL}
          style={{ ...horizontallyInside(left), ...verticalPlace }}
        >
          {label}
        </span>
      )}
    </>
  );
}

/**
 * Draws one month label under the plot.
 *
 * @param props - Where it sits, its text, and whether a pending value falls in it.
 * @returns The label.
 */
export function TickLabel({ left, label, highlighted }: {
  readonly left: number;
  readonly label: string;
  readonly highlighted: boolean;
}) {
  return (
    <span
      className={`${TICK} ${highlighted ? 'text-mint' : 'text-faint'}`}
      style={horizontallyInside(left)}
    >
      {label}
    </span>
  );
}

/**
 * Lists the values for assistive tech: the plot itself is a drawing.
 *
 * @param props - The caption and the points.
 * @returns The hidden table.
 */
export function PointsTable({ caption, points }: {
  readonly caption: string;
  readonly points: readonly PlacedPoint[];
}) {
  const translator = useI18n();
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{translator.text('lineChart', 'date')}</th>
          <th scope="col">{translator.text('lineChart', 'value')}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.key}>
            <td>{point.dateLabel}</td>
            <td>{point.valueLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
