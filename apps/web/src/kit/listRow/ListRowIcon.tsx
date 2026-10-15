import { Icon, type IconName } from '../icons/Icon';

// A list row's leading icon (K45, OQ-153): a glyph in a tinted circle — a
// session's device, an invitation's envelope, a notification's kind. People
// get an `Avatar` instead. Decorative: the row's title says what it is.

/** The circle's colour: a muted grey, or a tint of one of the accents. */
export type ListRowIconTone = 'neutral' | 'mint' | 'sky' | 'sun' | 'lilac';

/** The circle's size: 40px for rows, 36px for dense lists (notifications, pending invitations). */
export type ListRowIconSize = 'md' | 'sm';

/** The icon's props. */
export interface ListRowIconProps {
  /** The glyph, e.g. `laptop-mac-outline`. */
  readonly icon: IconName;
  /** Defaults to `neutral`. */
  readonly tone?: ListRowIconTone | undefined;
  /** Defaults to `md`. */
  readonly size?: ListRowIconSize | undefined;
}

const TONES: Record<ListRowIconTone, string> = {
  neutral: 'bg-ink/5 text-muted',
  mint: 'bg-mint/15 text-mint',
  sky: 'bg-sky/15 text-sky',
  sun: 'bg-sun/15 text-sun',
  lilac: 'bg-lilac/15 text-lilac',
};

const SIZES: Record<ListRowIconSize, string> = {
  md: 'size-10 text-xl',
  sm: 'size-9 text-lg',
};

/**
 * Builds the classes of the icon's circle.
 *
 * @param tone - The circle's colour.
 * @param size - The circle's size.
 * @returns The circle's classes.
 */
export const listRowIconClasses = (tone: ListRowIconTone, size: ListRowIconSize) => [
  'grid shrink-0 place-items-center rounded-full',
  TONES[tone],
  SIZES[size],
].join(' ');

/**
 * Renders the glyph in its tinted circle, hidden from screen readers.
 *
 * @param props - The glyph, the tone and the size.
 * @returns The circle.
 */
export function ListRowIcon({ icon, tone = 'neutral', size = 'md' }: ListRowIconProps) {
  return (
    <span aria-hidden="true" className={listRowIconClasses(tone, size)}>
      <Icon name={icon} />
    </span>
  );
}
