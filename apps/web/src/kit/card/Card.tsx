import type { ReactNode } from 'react';

// The kit's card (K34, OQ-135): the bordered surface every panel sits on — a
// page section, a nested contract panel, the wizard's step. It draws only the
// surface; the caller lays out what's inside (`flex flex-col gap-4`, a row).
// Rail cards are K36's: they have fixed widths of their own.

/** The card's padding, which sets its radius too: tighter cards round less. */
export type CardSize = 'none' | 'sm' | 'md' | 'lg';

/** The element the card renders as: a page section, a self-contained item or a plain box. */
export type CardElement = 'section' | 'article' | 'div';

/** The card's props. */
export interface CardProps {
  readonly children: ReactNode;
  /**
   * Defaults to `md`. `none` is for flush content, a ledger or a table, and
   * clips it (`overflow-clip`, so the ledger's month headers still stick).
   */
  readonly size?: CardSize | undefined;
  /** Defaults to `section`. */
  readonly as?: CardElement | undefined;
  /** The layout of the content and any extras, e.g. `flex flex-col gap-4`. */
  readonly className?: string | undefined;
}

const SIZES: Record<CardSize, string> = {
  none: 'overflow-clip rounded-card',
  sm: 'rounded-2xl p-4',
  md: 'rounded-card p-5',
  lg: 'rounded-3xl p-7',
};

/**
 * Builds the classes of a card.
 *
 * @param size - The card's padding and radius.
 * @param className - The caller's extra classes, if any.
 * @returns The card's classes.
 */
export const cardClasses = (size: CardSize, className?: string) => [
  'border border-line bg-card',
  SIZES[size],
  className,
].filter(Boolean).join(' ');

/**
 * Renders a card.
 *
 * @param props - The content, the size, the element and extra classes.
 * @returns The surface.
 */
export function Card({
  children, size = 'md', as: Element = 'section', className,
}: CardProps) {
  return <Element className={cardClasses(size, className)}>{children}</Element>;
}
