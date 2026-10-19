import type { CSSProperties } from 'react';
import type { CategoryIcon, PaletteToken } from '@financas/reference';
import { categoryColor, categoryTint } from '../../utilities/theme';
import { Icon } from '../icons/Icon';

// The kit's category chip (K50, OQ-184): how a category looks wherever it
// appears — its icon in its palette colour on a soft tint of it (OQ-85). The
// disc stands beside the category's name in the ledger, the pickers and the
// Categories page; the pill carries the name itself, as on a budget's card.
// The colour is a variable from ThemeUtility, so it follows the theme. It only
// displays: the pickers wrap it, and the caller translates the name.

/** The disc's size: 24px (pickers), 32px (setup's review), 36px (rows) or 40px (category cards). */
export type CategoryDiscSize = 'xs' | 'sm' | 'md' | 'lg';

/** The disc's props. */
export interface CategoryDiscProps {
  /** The category's icon. */
  readonly icon: CategoryIcon;
  /** The category's palette token. */
  readonly color: PaletteToken;
  /** Defaults to `md`. */
  readonly size?: CategoryDiscSize | undefined;
  /** Extra classes, e.g. a margin. */
  readonly className?: string | undefined;
}

/** The pill's props: the category's look and its name. */
export interface CategoryChipProps {
  /** The category's name, already translated, e.g. "Groceries". */
  readonly name: string;
  /** The category's icon. */
  readonly icon: CategoryIcon;
  /** The category's palette token. */
  readonly color: PaletteToken;
  /** Extra classes, e.g. `w-fit`. */
  readonly className?: string | undefined;
}

/** The pill's own 20px disc, inside it only. */
type DiscSize = CategoryDiscSize | 'pill';

const DISC_SIZES: Record<DiscSize, string> = {
  pill: 'size-5',
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-10',
};

const ICON_SIZES: Record<DiscSize, string> = {
  pill: 'size-3',
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-4.5',
  lg: 'size-5',
};

/**
 * Builds the classes of a disc.
 *
 * @param size - The disc's size.
 * @param className - The caller's extra classes, if any.
 * @returns The disc's classes.
 */
export const discClasses = (size: DiscSize, className?: string) => [
  'grid shrink-0 place-items-center rounded-full',
  DISC_SIZES[size],
  className,
].filter(Boolean).join(' ');

/**
 * Builds the classes of the pill.
 *
 * @param className - The caller's extra classes, if any.
 * @returns The pill's classes.
 */
export const chipClasses = (className?: string) => [
  'inline-flex h-7.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full',
  'bg-raised pr-3 pl-1.5 text-[13px] text-ink',
  className,
].filter(Boolean).join(' ');

/**
 * Builds a disc's colours: the icon in the category's colour on its tint.
 *
 * @param color - The category's palette token.
 * @returns The disc's inline style.
 */
export const discStyle = (color: PaletteToken): CSSProperties => ({
  color: categoryColor(color),
  backgroundColor: categoryTint(color),
});

/** The disc as drawn, the pill's own size included. */
interface DiscProps extends Omit<CategoryDiscProps, 'size'> {
  readonly size: DiscSize;
}

/**
 * Renders the tinted disc around the icon. It is decorative: the category's
 * name always stands beside it or in the pill.
 *
 * @param props - The icon, the colour, the size and extra classes.
 * @returns The disc.
 */
function Disc({
  icon, color, size, className,
}: DiscProps) {
  return (
    <span aria-hidden="true" className={discClasses(size, className)} style={discStyle(color)}>
      <Icon name={icon} className={ICON_SIZES[size]} />
    </span>
  );
}

/**
 * Renders a category's disc, to stand beside its name.
 *
 * @param props - The icon, the colour, the size (`md` by default) and extra classes.
 * @returns The decorative disc.
 */
export function CategoryDisc({
  icon, color, size = 'md', className,
}: CategoryDiscProps) {
  return <Disc icon={icon} color={color} size={size} className={className} />;
}

/**
 * Renders a category's pill: its small disc and its name.
 *
 * @param props - The name, the icon, the colour and extra classes.
 * @returns The pill.
 */
export function CategoryChip({
  name, icon, color, className,
}: CategoryChipProps) {
  return (
    <span className={chipClasses(className)}>
      <Disc icon={icon} color={color} size="pill" />
      {name}
    </span>
  );
}
