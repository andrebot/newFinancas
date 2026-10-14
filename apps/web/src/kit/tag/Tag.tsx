import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';

// The kit's tag (K30, OQ-133): a small static pill that labels something —
// a currency, an account kind, "Shared", "You", "read-only", a section's
// count or a "v2" marker. It is not interactive; a pill that opens a menu
// (the household's role column) is the Menu's trigger (K23).

/** The tag's colour: muted grey, or a tint of one of the accents. */
export type TagTone = 'neutral' | 'mint' | 'sky' | 'sun' | 'coral';

/** The tag's size: the mockups' 22px pill, its 20px variant for dense rows, or the caps marker. */
export type TagSize = 'md' | 'sm' | 'micro';

/** The tag's props. */
export interface TagProps {
  /** What the tag says, already translated. */
  readonly children: ReactNode;
  /** Defaults to `neutral`. */
  readonly tone?: TagTone | undefined;
  /** Defaults to `md`. */
  readonly size?: TagSize | undefined;
  /** A leading glyph, e.g. `group-outline` on "Shared". */
  readonly icon?: IconName | undefined;
  /** Extra classes, e.g. a margin or `w-fit`. */
  readonly className?: string | undefined;
}

const TONES: Record<TagTone, string> = {
  neutral: 'bg-raised text-muted',
  mint: 'bg-mint/10 text-mint',
  sky: 'bg-sky/10 text-sky',
  sun: 'bg-sun/10 text-sun',
  coral: 'bg-coral/10 text-coral',
};

const SIZES: Record<TagSize, string> = {
  md: 'h-5.5 gap-1 px-2.25 text-[0.6875rem] leading-none font-semibold',
  sm: 'h-5 gap-1 px-2 text-[0.6875rem] leading-none font-semibold',
  micro: 'gap-0.5 px-1.5 py-0.5 type-micro',
};

const ICON_SIZES: Record<TagSize, string> = {
  md: 'size-3.5',
  sm: 'size-3.5',
  micro: 'size-3',
};

/**
 * Builds the classes of a tag.
 *
 * @param tone - The tag's colour.
 * @param size - The tag's size.
 * @param className - The caller's extra classes, if any.
 * @returns The tag's classes.
 */
export const tagClasses = (tone: TagTone, size: TagSize, className?: string) => [
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full',
  TONES[tone],
  SIZES[size],
  className,
].filter(Boolean).join(' ');

/**
 * Renders a tag. The icon is decorative: the text names the tag.
 *
 * @param props - The text, the tone, the size and the optional icon.
 * @returns The pill.
 */
export function Tag({
  children, tone = 'neutral', size = 'md', icon, className,
}: TagProps) {
  return (
    <span className={tagClasses(tone, size, className)}>
      {icon && <Icon name={icon} className={ICON_SIZES[size]} />}
      {children}
    </span>
  );
}
