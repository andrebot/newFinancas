import type { ReactNode } from 'react';
import { InlineBanner } from '../../../kit/alert/InlineBanner';
import { IconButton } from '../../../kit/button/IconButton';
import { Icon, type IconName } from '../../../kit/icons/Icon';

// The pieces the Authenticate entries share (Sign In, mockups 01, 08 and 09;
// Account Recovery, mockups 03 and 04): the heading (with the icon tile), the
// failure banner, the mint text actions and the back arrow in the page's
// corner. Display only: each takes translated text and emits its click.

/** The heading's props. */
export interface StepHeadingProps {
  readonly title: string;
  readonly subtitle: string;
  /** The mint tile above the title, on every step but Sign In's first. */
  readonly icon?: IconName | undefined;
}

/**
 * Renders a step's heading: the optional icon tile, the title and the line
 * under it.
 *
 * @param props - The texts and the icon.
 * @returns The heading.
 */
export function StepHeading({ title, subtitle, icon }: StepHeadingProps) {
  return (
    <>
      {icon && (
        <div className="grid size-14 place-items-center rounded-2xl bg-mint/15 text-mint">
          <Icon name={icon} className="size-7" />
        </div>
      )}
      <div>
        <h1 className="type-display-md">{title}</h1>
        <p className="mt-1.5 text-muted">{subtitle}</p>
      </div>
    </>
  );
}

/**
 * Renders the last failure, when there is one.
 *
 * @param props - The failure, already translated.
 * @returns The error banner, or nothing.
 */
export function StepAlert({ message }: { readonly message?: string | undefined }) {
  return message ? <InlineBanner tone="error" message={message} /> : null;
}

/** A text action's props. */
export interface TextActionProps {
  readonly children: ReactNode;
  readonly onClick: () => void;
  /** Typography only: `font-semibold` in a sentence, `type-caption font-medium` beside a label. */
  readonly className: string;
}

/**
 * Renders a mint text action, e.g. "Create an account". A button, not a
 * link: where it leads is the Experience's call.
 *
 * @param props - The label, the click handler and the typography.
 * @returns The button.
 */
export function TextAction({ children, onClick, className }: TextActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-sm text-mint hover:underline',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/** The back arrow's props. */
export interface BackButtonProps {
  /** The button's name, already translated. */
  readonly label: string;
  readonly onBack: () => void;
}

/**
 * Renders the back arrow in the page's top-left corner, as the challenge
 * mockups place it.
 *
 * @param props - The name and the click handler.
 * @returns The button.
 */
export function BackButton({ label, onBack }: BackButtonProps) {
  return (
    <IconButton
      icon="arrow-back"
      label={label}
      tone="outline"
      size="md"
      className="absolute top-6 left-6 sm:top-8 sm:left-8"
      onClick={onBack}
    />
  );
}
