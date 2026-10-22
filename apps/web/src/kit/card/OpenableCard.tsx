import type { ReactNode } from 'react';
import { Card } from './Card';

// The kit's openable card (OQ-194): a card the whole of which opens its item —
// an account's, a budget's or a goal's edit drawer (FL11, FL13, FL14), where
// Edit and the other actions live. Its name is its one button, the hit area
// stretched over the card, so a screen reader hears a single button by the
// name. The rest of the card is display only, but for the odd control the
// caller lifts above the hit area with `ABOVE_OPENER` — a goal's rate field
// (OQ-195). A card made of controls (a category's) still can't be one. Without
// a way to open it, it is a plain card.

/** The name button's hit area, stretched over its card while it opens one. */
const STRETCHED = "after:absolute after:inset-0 after:rounded-card after:content-['']";

/**
 * Lifts a control inside the card above the stretched hit area, so it takes
 * its own clicks and typing instead of opening the item (OQ-195).
 */
export const ABOVE_OPENER = 'relative z-10';

/**
 * Builds the classes of an openable card: lifted on hover while it opens.
 *
 * @param openable - Whether the card opens its item.
 * @param className - The caller's layout, e.g. `flex flex-col gap-3`.
 * @returns The card's classes, beside the surface's own.
 */
export const openableCardClasses = (openable: boolean, className?: string) => [
  'relative',
  className,
  openable ? 'cursor-pointer transition-colors hover:border-muted' : '',
].filter(Boolean).join(' ');

/**
 * Builds the classes of the name button: stretched over the card while it opens.
 *
 * @param openable - Whether the card opens its item.
 * @returns The button's classes.
 */
export const openerClasses = (openable: boolean) => [
  'min-w-0 flex-1 break-words text-left',
  openable ? `cursor-pointer ${STRETCHED}` : '',
].filter(Boolean).join(' ');

/** The openable card's props. */
export interface OpenableCardProps {
  /** The item's name: the button's text and its accessible name. */
  readonly name: string;
  /** The name's type, e.g. `type-heading-sm`. */
  readonly nameClassName?: string | undefined;
  /** Shown before the name, e.g. a goal's disc. Display only. */
  readonly leading?: ReactNode;
  /** Shown beside the name, e.g. its tags. Display only. */
  readonly aside?: ReactNode;
  /** Opens the item; without it the card is plain and its name a disabled button. */
  readonly onOpen?: (() => void) | undefined;
  /** The card's layout, e.g. `flex flex-col gap-3`. */
  readonly className?: string | undefined;
  /** The rest of the card, below the name. Display only. */
  readonly children?: ReactNode;
}

/**
 * Renders a card that opens its item from anywhere on it.
 *
 * @param props - The name, what sits before and beside it, the opener, the layout and the content.
 * @returns The card.
 */
export function OpenableCard({
  name, nameClassName, leading, aside, onOpen, className, children,
}: OpenableCardProps) {
  const openable = onOpen !== undefined;
  return (
    <Card className={openableCardClasses(openable, className)}>
      <div className="flex items-start gap-2">
        {leading}
        <button
          type="button"
          onClick={onOpen}
          disabled={!openable}
          className={openerClasses(openable)}
        >
          <span className={nameClassName}>{name}</span>
        </button>
        {aside}
      </div>
      {children}
    </Card>
  );
}
