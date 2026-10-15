import type { PasswordStrength, StrengthLevel } from '../../utilities/passwordStrength';

// The password strength meter (K6, OQ-144), from the register, reset and
// change-password mockups: four bars that fill and take the level's colour,
// and a caption under them. It only draws: the reading comes from
// PasswordStrengthUtility and the caption from its `strengthCaption`, already
// translated. The bars are decoration; the caption carries the reading, and
// the password field points its input's `aria-describedby` at it.

/** The meter's props. */
export interface StrengthMeterProps {
  readonly reading: PasswordStrength;
  /** E.g. "Fair · avoid dates and years". */
  readonly caption: string;
  /** The caption's id, which the input is described by. */
  readonly captionId: string;
}

/** The meter's four bars, one per level above `too_short`; the names are their keys. */
const BARS = ['first', 'second', 'third', 'fourth'] as const;

/** The colour of a filled bar, per level; `too_short` fills none. */
const FILL_BY_LEVEL: Readonly<Record<StrengthLevel, string>> = {
  too_short: 'bg-line',
  weak: 'bg-coral',
  fair: 'bg-sun',
  good: 'bg-mint',
  strong: 'bg-mint',
};

/**
 * Builds one bar's classes: the level's colour while filled, the line colour
 * while empty.
 *
 * @param filled - Whether the bar is filled.
 * @param level - The reading's level.
 * @returns The bar's classes.
 */
export const barClasses = (filled: boolean, level: StrengthLevel) => [
  'h-1.5 flex-1 rounded-full transition-colors duration-150',
  filled ? FILL_BY_LEVEL[level] : 'bg-line',
].join(' ');

/**
 * Renders the strength meter: four bars and the caption.
 *
 * @param props - The reading, its caption and the caption's id.
 * @returns The meter.
 */
export function StrengthMeter({ reading, caption, captionId }: StrengthMeterProps) {
  return (
    <div className="flex flex-col gap-1.5" data-level={reading.level}>
      <div className="flex gap-1" aria-hidden="true">
        {BARS.map((bar, index) => (
          <span key={bar} className={barClasses(index < reading.segments, reading.level)} />
        ))}
      </div>
      <span id={captionId} className="type-caption text-muted">{caption}</span>
    </div>
  );
}
