import type { CSSProperties } from 'react';
import { FILL_MOTION_DURATION, clampPercent, progressAttributes } from '../progress/progress';

// The kit's progress bar (K33, OQ-181): how far along something is, as a
// share of 100%. Two shapes from the mockups: the 28px pill with the amount
// written inside (goal cards, the Investments Goals panel) and the 8px thin
// bar with no text, which can stack segments (the buy drawer's allocation
// total, a holding's term elapsed). It only displays; the caller formats the
// text (FormattingUtility) and passes plain percentages.

/** The fill's colour: sky by default, mint for a completed goal. */
export type ProgressTone = 'sky' | 'mint';

/** A thin bar's segment colour: the two tones, or sky's softer shade for alternating segments. */
export type SegmentTone = ProgressTone | 'skysoft';

/** One stretch of a thin bar. */
export interface ProgressSegment {
  /** Its share of the bar, in percent. */
  readonly value: number;
  /** Defaults to `sky`. */
  readonly tone?: SegmentTone | undefined;
}

/** The pill's props: one value with its text inside. */
export interface PillProgressBarProps {
  readonly size?: 'pill' | undefined;
  /** How far along, in percent; the fill is held to 0–100. */
  readonly value: number;
  /** The text inside the pill, already formatted, e.g. "$3,200.00 / $10,000.00". */
  readonly label?: string | undefined;
  /** Defaults to `sky`. */
  readonly tone?: ProgressTone | undefined;
  /** The bar's accessible name, already translated. */
  readonly ariaLabel: string;
}

/** The thin bar's props: one or more segments, no text. */
export interface ThinProgressBarProps {
  readonly size: 'thin';
  /** Drawn left to right; together they are held to 100%. */
  readonly segments: readonly ProgressSegment[];
  /** The bar's accessible name, already translated. */
  readonly ariaLabel: string;
  /** What a screen reader says for the value, e.g. "85% allocated · 15% free". */
  readonly ariaValueText?: string | undefined;
}

/** The progress bar's props. */
export type ProgressBarProps = PillProgressBarProps | ThinProgressBarProps;

const FILLS: Record<SegmentTone, string> = {
  sky: 'bg-sky',
  skysoft: 'bg-sky/60',
  mint: 'bg-mint',
};

const ON_FILL_TEXT: Record<ProgressTone, string> = {
  sky: 'text-onsky',
  mint: 'text-onmint',
};

/** The pill's track. */
export const PILL_TRACK = 'relative h-7 overflow-hidden rounded-full bg-track';

/** The thin bar's track, a row the segments sit in. */
export const THIN_TRACK = 'flex h-2 overflow-hidden rounded-full bg-raised';

/** The width animation every fill shares. */
export const FILL_MOTION = `transition-[width] ${FILL_MOTION_DURATION} ease-out`;

/** The text inside the pill, centred; two copies are laid over each other. */
export const PILL_LABEL = [
  'absolute inset-0 flex items-center justify-center px-3.5 whitespace-nowrap',
  'text-xs font-semibold tabular-nums',
].join(' ');

/**
 * Holds each segment to what is left of the bar, so together they never
 * pass 100%; a segment past the end gets no width.
 *
 * @param segments - The segments, left to right.
 * @returns Each segment's drawn width, in percent, in the same order.
 */
export const clampSegments = (segments: readonly ProgressSegment[]): number[] => (
  segments.reduce<number[]>((widths, segment) => {
    const used = widths.reduce((sum, width) => sum + width, 0);
    return [...widths, Math.min(clampPercent(segment.value), 100 - used)];
  }, [])
);

/**
 * Renders the pill: the fill, the text in ink over the track, and a copy in
 * the tone's dark ink clipped to the fill, so the text reads on both.
 *
 * @param props - The value, text, tone and name.
 * @returns The pill.
 */
function PillProgressBar({
  value, label, tone = 'sky', ariaLabel,
}: PillProgressBarProps) {
  const width = clampPercent(value);
  const onFillClip: CSSProperties = { clipPath: `inset(0 ${100 - width}% 0 0)` };

  return (
    <div className={PILL_TRACK} {...progressAttributes(ariaLabel, width, label)}>
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${FILLS[tone]} ${FILL_MOTION}`}
        style={{ width: `${width}%` }}
      />
      {label && (
        <>
          <div aria-hidden="true" className={`${PILL_LABEL} text-ink`}>{label}</div>
          <div
            aria-hidden="true"
            className={`${PILL_LABEL} ${ON_FILL_TEXT[tone]}`}
            style={onFillClip}
          >
            {label}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Renders the thin bar: its segments side by side, left to right.
 *
 * @param props - The segments, name and value text.
 * @returns The thin bar.
 */
function ThinProgressBar({ segments, ariaLabel, ariaValueText }: ThinProgressBarProps) {
  const widths = clampSegments(segments);
  const total = widths.reduce((sum, width) => sum + width, 0);

  return (
    <div className={THIN_TRACK} {...progressAttributes(ariaLabel, total, ariaValueText)}>
      {segments.map((segment, index) => (
        <div
          // Segments have no identity of their own; their order is the key.
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={`h-full ${FILLS[segment.tone ?? 'sky']} ${FILL_MOTION}`}
          style={{ width: `${widths[index]}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Tells the thin bar's props from the pill's.
 *
 * @param props - Either shape's props.
 * @returns Whether they are the thin bar's.
 */
export const isThin = (props: ProgressBarProps): props is ThinProgressBarProps => (
  props.size === 'thin'
);

/**
 * Renders a progress bar: the pill with its text inside, or the thin bar of
 * one or more segments. It holds no state.
 *
 * @param props - The pill's or the thin bar's props, told apart by `size`.
 * @returns The progress bar.
 */
export function ProgressBar(props: ProgressBarProps) {
  return isThin(props)
    ? <ThinProgressBar {...props} />
    : <PillProgressBar {...props} />;
}
