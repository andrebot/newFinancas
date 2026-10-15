import type { ReactNode } from 'react';

// The kit's list row (K45, OQ-153): a leading avatar or icon, a title, a meta
// line and trailing actions — the household's members and pending invitations
// (mockup 60), the profile's sessions and invitations (70), the notification
// inbox (23) and the dashboard's coming due (20). `ListRows` is the list and
// sets the surface: hairlines between rows, or each row its own raised card.
// The row is not a click target; its actions live in `trailing` or `footer`.

/** How the rows are drawn: hairlines between them, or each one a raised card. */
export type ListRowSurface = 'divided' | 'raised';

/**
 * The title's weight: a name (semibold, cut to one line), or a sentence with
 * its own bold parts (regular, wraps).
 */
export type ListRowTitleWeight = 'semibold' | 'regular';

/** The list's props. */
export interface ListRowsProps {
  /** The `ListRow`s, in display order. */
  readonly children: ReactNode;
  /** Defaults to `divided`. */
  readonly surface?: ListRowSurface | undefined;
  /** The list's accessible name, already translated, when no heading names it. */
  readonly label?: string | undefined;
  /** Extra classes, e.g. a margin. */
  readonly className?: string | undefined;
}

/** The row's props. */
export interface ListRowProps {
  /** The `Avatar`, `ListRowIcon` or other mark at the start, e.g. a date tile. */
  readonly leading?: ReactNode;
  /** The name or sentence, already translated; may hold a `Tag` ("You"). */
  readonly title: ReactNode;
  /** The muted line under the title, e.g. "jane@example.com · since 01/2024". */
  readonly meta?: ReactNode;
  /** What sits at the end: a role pill, icon buttons, an amount or "Revoke". */
  readonly trailing?: ReactNode;
  /** Actions under the text, e.g. a notification's Accept / Decline; aligns the row to the top. */
  readonly footer?: ReactNode;
  /** Defaults to `semibold`. */
  readonly titleWeight?: ListRowTitleWeight | undefined;
  /** Fades the row, e.g. a notification already seen. */
  readonly dimmed?: boolean | undefined;
}

const SURFACES: Record<ListRowSurface, string> = {
  divided: 'flex flex-col *:px-1 *:py-3 *:not-last:border-b *:not-last:border-line/70',
  raised: 'flex flex-col gap-2 *:rounded-xl *:bg-raised *:px-3 *:py-2.5',
};

const TITLE_WEIGHTS: Record<ListRowTitleWeight, string> = {
  semibold: 'type-body truncate font-semibold text-ink',
  regular: 'type-body text-ink',
};

/**
 * Builds the classes of the list.
 *
 * @param surface - Hairlines between rows, or raised cards.
 * @param className - The caller's extra classes, if any.
 * @returns The list's classes.
 */
export const listRowsClasses = (surface: ListRowSurface, className?: string) => [
  SURFACES[surface],
  className,
].filter(Boolean).join(' ');

/**
 * Builds the classes of a row.
 *
 * @param hasFooter - Whether actions sit under the text, which aligns the row to the top.
 * @param dimmed - Whether the row is faded.
 * @returns The row's classes.
 */
export const listRowClasses = (hasFooter: boolean, dimmed: boolean) => [
  'flex gap-3',
  hasFooter ? 'items-start' : 'items-center',
  dimmed ? 'opacity-60' : '',
].filter(Boolean).join(' ');

/**
 * Renders the list that holds the rows and draws their surface.
 *
 * @param props - The rows, the surface, the accessible name and extra classes.
 * @returns The `ul`.
 */
export function ListRows({
  children, surface = 'divided', label, className,
}: ListRowsProps) {
  return (
    <ul aria-label={label} className={listRowsClasses(surface, className)}>
      {children}
    </ul>
  );
}

/**
 * Renders one row: the leading mark, the title over its meta line and footer,
 * and the trailing actions.
 *
 * @param props - The slots, the title's weight and whether the row is faded.
 * @returns The `li`.
 */
export function ListRow({
  leading, title, meta, trailing, footer, titleWeight = 'semibold', dimmed = false,
}: ListRowProps) {
  return (
    <li className={listRowClasses(Boolean(footer), dimmed)}>
      {leading && <div className="flex shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className={TITLE_WEIGHTS[titleWeight]}>{title}</div>
        {meta && <div className="mt-0.5 truncate type-caption text-muted">{meta}</div>}
        {footer && <div className="mt-2 flex flex-wrap gap-2">{footer}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </li>
  );
}
