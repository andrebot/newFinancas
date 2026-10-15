import type { ButtonHTMLAttributes, Ref } from 'react';
import { Icon, type IconName } from '../icons/Icon';

// The menu's pill (K23, OQ-140), from mockup 60's members list: a 32px
// rounded pill showing a current choice, e.g. a member's role. `MenuPill` is
// the button that opens a Menu, with a chevron that turns over while open.
// `StaticPill` is the same pill when there is nothing to choose — the Owner's
// role, in mint with its crown — so both line up in the same column.

/** The look both pills share: size, shape and text. */
const PILL_BASE = 'inline-flex h-8 shrink-0 items-center rounded-full border type-body-sm';

const MENU_PILL = [
  PILL_BASE,
  'group gap-1 border-line pr-2.5 pl-3 font-medium text-ink outline-none',
  'transition-[border-color,box-shadow] duration-150 enabled:hover:bg-ink/5',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
  'aria-expanded:border-mint/60 aria-expanded:ring-3 aria-expanded:ring-mint/15',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const STATIC_PILL = `${PILL_BASE} gap-1.5 border-mint/50 bg-mintdeep px-3 font-semibold text-mint`;

/** The menu pill's props: the native button ones plus what it shows. */
export interface MenuPillProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** The current choice, already translated, e.g. "Member". */
  readonly label: string;
  readonly ref?: Ref<HTMLButtonElement> | undefined;
}

/** The static pill's props. */
export interface StaticPillProps {
  /** What it shows, already translated, e.g. "Owner". */
  readonly label: string;
  /** Before the label, e.g. the Owner's crown; decorative. */
  readonly icon?: IconName | undefined;
}

/**
 * Renders the pill that opens a Menu. It takes every native prop, so the
 * Menu's trigger props spread on it; while the menu is open it is ringed in
 * mint and its chevron points up.
 *
 * @param props - The native props and the current choice.
 * @returns The button.
 */
export function MenuPill({ label, type = 'button', ...native }: MenuPillProps) {
  return (
    // A dynamic type is fine: it is one of the three native values, `button` by default.
    // eslint-disable-next-line react/button-has-type
    <button {...native} type={type} className={MENU_PILL}>
      {label}
      <Icon
        name="expand-more"
        className="size-4 shrink-0 text-muted transition-transform group-aria-expanded:rotate-180"
      />
    </button>
  );
}

/**
 * Renders the pill as a plain label, for a choice that can't be changed.
 *
 * @param props - The label and its optional icon.
 * @returns The pill.
 */
export function StaticPill({ label, icon }: StaticPillProps) {
  return (
    <span className={STATIC_PILL}>
      {icon && <Icon name={icon} className="size-4 shrink-0" />}
      {label}
    </span>
  );
}
