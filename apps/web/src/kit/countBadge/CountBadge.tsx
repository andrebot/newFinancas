import { badge } from '../../config/constants';

// The kit's count badge (K30, OQ-133): the small coral circle on an icon
// button that says how many things wait, e.g. the bell's unseen
// notifications. It only draws the bubble; the caller places it (usually
// `absolute` in the button's corner). The number is for the eye; screen
// readers get the translated `label` instead, as part of the button's name.

/** The count badge's props. */
export interface CountBadgeProps {
  /** How many things wait; nothing renders at zero. */
  readonly count: number;
  /** The count in words, already translated, e.g. "2 unseen notifications". */
  readonly label: string;
  /** Where the caller puts it, e.g. `absolute top-1.5 right-1.5`. */
  readonly className?: string | undefined;
}

const BUBBLE = 'grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 '
  + 'text-oncoral type-micro tabular-nums';

/**
 * Turns a count into what the badge shows: the number, or "9+" once it
 * passes the cap, so the badge never outgrows its circle.
 *
 * @param count - How many things wait.
 * @param maxCount - The highest count shown as is.
 * @returns The badge's text.
 */
export const countBadgeText = (count: number, maxCount: number) => (
  count > maxCount ? `${maxCount}+` : String(count)
);

/**
 * Renders the count badge, or nothing when there is nothing to count.
 *
 * @param props - The count, its spoken label and the placement classes.
 * @returns The coral bubble, or `null` at zero.
 */
export function CountBadge({ count, label, className }: CountBadgeProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={[BUBBLE, className].filter(Boolean).join(' ')}
    >
      <span aria-hidden="true">{countBadgeText(count, badge.maxCount)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
