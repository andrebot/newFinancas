import type {
  ButtonHTMLAttributes, MouseEvent, ReactNode, Ref,
} from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { useRipple } from './ripple';

// The kit's text button (K4, OQ-136): every labelled action in the mockups,
// from the auth CTA to a row's "Remove". It is a native <button> that takes
// every native prop and `ref`, so a Popover or Menu trigger spreads its ARIA
// props on it. Icon-only buttons are `IconButton`; a link styled as a button
// uses `buttonClasses` on the Experience's own link. A press ripples (`useRipple`).

/** The button's look, from the main action down to the destructive ones. */
export type ButtonVariant = 'primary' | 'tonal' | 'secondary' | 'ghost'
  | 'danger' | 'danger-ghost' | 'danger-solid';

/** The button's height: 32, 36, 40 or 46px (the auth and wizard CTA). */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

/** The button's look, as `buttonClasses` takes it. */
export interface ButtonLook {
  /** Defaults to `secondary`. */
  readonly variant?: ButtonVariant | undefined;
  /** Defaults to `md`. */
  readonly size?: ButtonSize | undefined;
  /** The mint glow under a raised primary action (the auth CTA, the floating Record). */
  readonly elevated?: boolean | undefined;
  /** Layout only, e.g. `w-full`, `flex-1`, `shrink-0`. */
  readonly className?: string | undefined;
}

/** The button's props: the native ones plus its look, icons and busy state. */
export interface ButtonProps
  extends ButtonLook, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** Shown before the label; decorative, the label names the button. */
  readonly leadingIcon?: IconName | undefined;
  /** Shown after the label, e.g. the "Sign in →" arrow; decorative. */
  readonly trailingIcon?: IconName | undefined;
  /**
   * While true a spinner covers the label, which keeps its space, and clicks
   * (and form submits through it) are ignored. The button stays focusable.
   */
  readonly busy?: boolean | undefined;
  readonly ref?: Ref<HTMLButtonElement> | undefined;
}

/** The base every kit button shares: fully rounded, the mint keyboard focus ring. */
export const BUTTON_BASE = [
  'relative inline-flex shrink-0 items-center justify-center rounded-full',
  'transition-colors duration-150',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-mint font-semibold text-onmint enabled:hover:bg-mint/90',
  tonal: 'bg-mint/10 font-semibold text-mint enabled:hover:bg-mint/15',
  secondary: 'border border-line font-medium text-ink enabled:hover:bg-ink/5',
  ghost: 'font-medium text-muted enabled:hover:bg-ink/5 enabled:hover:text-ink',
  danger: 'border border-coral/40 font-medium text-coral enabled:hover:bg-coral/10',
  'danger-ghost': 'font-medium text-coral enabled:hover:bg-coral/10',
  'danger-solid': 'bg-coral font-semibold text-oncoral enabled:hover:bg-coral/90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 type-body',
  md: 'h-9 px-4 type-body',
  lg: 'h-10 px-5 type-body-lg',
  xl: 'h-[46px] px-6 type-body-lg',
};

/** The label row's gap and the icons' size, per button size. */
const CONTENT: Record<ButtonSize, string> = {
  sm: 'gap-1.5 [&_svg]:size-4',
  md: 'gap-1.5 [&_svg]:size-4',
  lg: 'gap-2 [&_svg]:size-4.5',
  xl: 'gap-2 [&_svg]:size-4.5',
};

/**
 * Builds the classes of a text button, for a `<button>` or a link that looks
 * like one.
 *
 * @param look - The variant, size, glow and layout classes.
 * @returns The button's classes.
 */
export const buttonClasses = ({
  variant = 'secondary', size = 'md', elevated = false, className,
}: ButtonLook = {}) => [
  BUTTON_BASE,
  VARIANTS[variant],
  SIZES[size],
  elevated ? 'shadow-glow' : undefined,
  className,
].filter(Boolean).join(' ');

/**
 * Builds the classes of the label row, hidden (but still taking its space)
 * while the spinner covers it.
 *
 * @param size - The button's size, which sets the gap and icon size.
 * @param busy - Whether the spinner covers the label.
 * @returns The label row's classes.
 */
export const contentClasses = (size: ButtonSize, busy: boolean) => [
  'inline-flex items-center',
  CONTENT[size],
  busy ? 'invisible' : undefined,
].filter(Boolean).join(' ');

/**
 * Wraps the caller's click handler so a busy button does nothing: the click
 * is dropped and, for a submit button, the form submit it would trigger too.
 *
 * @param busy - Whether the button is busy.
 * @param onClick - The caller's handler, if any.
 * @returns The handler the native button gets.
 */
export const guardClick = (
  busy: boolean,
  onClick: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined,
) => (event: MouseEvent<HTMLButtonElement>) => {
  if (busy) {
    event.preventDefault();
    return;
  }
  onClick?.(event);
};

/** The label row's props: what `Button` draws inside itself. */
interface ButtonContentProps {
  readonly size: ButtonSize;
  readonly busy: boolean;
  readonly leadingIcon: IconName | undefined;
  readonly trailingIcon: IconName | undefined;
  readonly children: ReactNode;
}

/**
 * Renders the label with its icons and, while busy, the spinner over it.
 *
 * @param props - The size, the busy state, the icons and the label.
 * @returns The button's inside.
 */
function ButtonContent({
  size, busy, leadingIcon, trailingIcon, children,
}: ButtonContentProps) {
  return (
    <>
      <span className={contentClasses(size, busy)}>
        {leadingIcon && <Icon name={leadingIcon} />}
        {children}
        {trailingIcon && <Icon name={trailingIcon} />}
      </span>
      {busy && (
        <span className={`absolute inset-0 grid place-items-center ${CONTENT[size]}`}>
          <Icon name="progress-activity" className="motion-safe:animate-spin" />
        </span>
      )}
    </>
  );
}

/**
 * Renders a text button.
 *
 * @param props - The native props, the look, the icons and the busy state.
 * @returns The button.
 */
export function Button({
  variant, size = 'md', elevated, className, leadingIcon, trailingIcon,
  busy = false, type = 'button', onClick, onPointerDown, children, ...native
}: ButtonProps) {
  const ripple = useRipple(!busy && !native.disabled, {
    onPointerDown, onClick: guardClick(busy, onClick),
  });

  return (
    <button
      {...native}
      // A dynamic type is fine: it is one of the three native values, `button` by default.
      // eslint-disable-next-line react/button-has-type
      type={type}
      className={buttonClasses({
        variant, size, elevated, className,
      })}
      aria-busy={busy || undefined}
      aria-disabled={busy || native['aria-disabled']}
      onPointerDown={ripple.onPointerDown}
      onClick={ripple.onClick}
    >
      {ripple.layer}
      <ButtonContent size={size} busy={busy} leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </button>
  );
}
