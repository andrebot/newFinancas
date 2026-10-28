import { FILL_MOTION_DURATION, clampPercent, progressAttributes } from '../progressBar/ProgressBar';

// The kit's progress ring (K32, OQ-209): how far along a budget or a goal is,
// as a ring with its percent inside (the rail cards on mockups 20–24, the
// auth panel's preview). It is drawn in SVG, so the hole is see-through on
// any surface and the fill can animate. It only displays: the caller picks
// the tone (K36 decides when a budget is near or over its limit) and formats
// the label (FormattingUtility).

/** The fill's colour: sky for goals; mint, sun or coral as a budget fills up. */
export type RingTone = 'sky' | 'mint' | 'sun' | 'coral';

/** The ring's size: `md` (64px) on the rail cards, `sm` (52px) in the auth preview. */
export type RingSize = 'sm' | 'md';

/** The progress ring's props. */
export interface ProgressRingProps {
  /** How far along, in percent; the fill is held to 0–100. */
  readonly value: number;
  /** The text inside, already formatted, e.g. "106%"; it may pass 100%. */
  readonly label?: string | undefined;
  /** Defaults to `sky`. */
  readonly tone?: RingTone | undefined;
  /** Defaults to `md`. */
  readonly size?: RingSize | undefined;
  /** The ring's accessible name, already translated. */
  readonly ariaLabel: string;
}

/** The SVG's drawing box; both sizes scale the same drawing. */
export const RING_BOX = 64;

/** The ring's thickness: the mockups' hole is 78% of the ring's width. */
export const RING_STROKE = 7;

/** The circle's radius, so the stroke ends at the box's edge. */
export const RING_RADIUS = (RING_BOX - RING_STROKE) / 2;

const STROKES: Record<RingTone, string> = {
  sky: 'stroke-sky',
  mint: 'stroke-mint',
  sun: 'stroke-sun',
  coral: 'stroke-coral',
};

const SIZES: Record<RingSize, string> = {
  sm: 'size-13 text-xs',
  md: 'size-16 text-[0.8125rem]',
};

/** The ring's box: the SVG behind, the label centred on top. */
export const RING_FRAME = 'relative grid shrink-0 place-items-center font-bold tabular-nums';

/** The fill's sweep animation (the design system's 150–250ms), off under reduced motion. */
export const RING_MOTION = [
  `transition-[stroke-dashoffset] ${FILL_MOTION_DURATION} ease-out`,
  'motion-reduce:transition-none',
].join(' ');

/**
 * Picks the label's colour: coral when the budget is over, faint while
 * nothing is done yet, the ink otherwise (as on the mockups).
 *
 * @param tone - The ring's tone.
 * @param value - The value, already held to 0–100.
 * @returns The label's text colour class.
 */
export const labelColour = (tone: RingTone, value: number): string => {
  if (tone === 'coral') {
    return 'text-coral';
  }
  return value === 0 ? 'text-faint' : 'text-ink';
};

/**
 * Renders a progress ring: the track, the fill from the top, clockwise,
 * and the label inside. It holds no state.
 *
 * @param props - The value, label, tone, size and name.
 * @returns The progress ring.
 */
export function ProgressRing({
  value, label, tone = 'sky', size = 'md', ariaLabel,
}: ProgressRingProps) {
  const held = clampPercent(value);
  const centre = RING_BOX / 2;
  const circle = {
    cx: centre, cy: centre, r: RING_RADIUS, fill: 'none', strokeWidth: RING_STROKE, pathLength: 100,
  };

  return (
    <div className={`${RING_FRAME} ${SIZES[size]}`} {...progressAttributes(ariaLabel, held, label)}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle {...circle} className="stroke-track" />
        <circle
          {...circle}
          strokeDasharray="100 100"
          strokeDashoffset={100 - held}
          className={`${STROKES[tone]} ${RING_MOTION}`}
        />
      </svg>
      {label && (
        <span aria-hidden="true" className={`relative ${labelColour(tone, held)}`}>{label}</span>
      )}
    </div>
  );
}
