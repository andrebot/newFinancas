import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { BUTTON_BASE } from './Button';
import { useRipple } from './ripple';

// The kit's icon-only button (K4, OQ-136): the round buttons of the mockups —
// the header's bell and menu, a drawer's close, the rails' arrows, the auth
// "back". It has no visible text, so its translated `label` is required and
// becomes the button's name. Like `Button`, it takes every native prop and
// `ref`, so a Popover trigger spreads its ARIA props on it, and a press ripples.

/** The icon button's look: quiet (`ghost`) or ringed (`outline`, the rail arrows). */
export type IconButtonTone = 'ghost' | 'outline';

/** The icon button's diameter: 28, 32, 36 or 40px. */
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/** The icon button's props. */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  readonly icon: IconName;
  /** The button's name, already translated, e.g. "Close". */
  readonly label: string;
  /** Defaults to `ghost`. */
  readonly tone?: IconButtonTone | undefined;
  /** Defaults to `sm` (32px). */
  readonly size?: IconButtonSize | undefined;
  /** Drawn in the button's corner, e.g. the bell's `CountBadge`; its label joins the name. */
  readonly badge?: ReactNode;
  /** Layout only, e.g. `ml-auto`. */
  readonly className?: string | undefined;
  readonly ref?: Ref<HTMLButtonElement> | undefined;
}

const TONES: Record<IconButtonTone, string> = {
  ghost: 'text-faint enabled:hover:bg-ink/5 enabled:hover:text-ink',
  outline: 'border border-line text-muted enabled:hover:bg-ink/5 enabled:hover:text-ink',
};

/** The circle's size and the glyph's, per size. */
const SIZES: Record<IconButtonSize, string> = {
  xs: 'size-7 [&>svg]:size-4',
  sm: 'size-8 [&>svg]:size-4.5',
  md: 'size-9 [&>svg]:size-5',
  lg: 'size-10 [&>svg]:size-5.5',
};

/**
 * Builds the classes of an icon button.
 *
 * @param tone - Quiet or ringed.
 * @param size - The diameter.
 * @param className - The caller's layout classes, if any.
 * @returns The button's classes.
 */
export const iconButtonClasses = (
  tone: IconButtonTone,
  size: IconButtonSize,
  className?: string,
) => [BUTTON_BASE, TONES[tone], SIZES[size], className].filter(Boolean).join(' ');

/**
 * Renders a round, icon-only button.
 *
 * @param props - The native props, the glyph, the name, the look and a badge.
 * @returns The button.
 */
export function IconButton({
  icon, label, tone = 'ghost', size = 'sm', badge, className, type = 'button',
  onPointerDown, onClick, ...native
}: IconButtonProps) {
  const ripple = useRipple(!native.disabled, { onPointerDown, onClick });

  return (
    <button
      {...native}
      // A dynamic type is fine: it is one of the three native values, `button` by default.
      // eslint-disable-next-line react/button-has-type
      type={type}
      className={iconButtonClasses(tone, size, className)}
      onPointerDown={ripple.onPointerDown}
      onClick={ripple.onClick}
    >
      {ripple.layer}
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
      {/* Keeps the label and the badge's own label apart in the name; flex drops it visually. */}
      {badge && ' '}
      {badge}
    </button>
  );
}
