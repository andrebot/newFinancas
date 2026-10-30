import type { ReactNode } from 'react';

// The kit's section header (K34, OQ-135): the title line over a card's
// content or a rail — "Balances" with its "September/2026" chip and the rail
// arrows, "Members" with "You're the Owner", "Payout over time" with its
// description and total. Texts arrive translated and formatted.

/** The heading level: `h2` under the page's `h1`, `h3` inside a section. */
export type SectionHeadingLevel = 'h2' | 'h3';

/** The section header's props. */
export interface SectionHeaderProps {
  readonly title: string;
  /** Defaults to `h2`. */
  readonly as?: SectionHeadingLevel | undefined;
  /** The period the section shows, already formatted, e.g. "September/2026". */
  readonly period?: string | undefined;
  /**
   * Shows the period's chip only from `xl`: on a phone the page's own period
   * bar already names the month (mockup 34).
   */
  readonly periodFromXl?: boolean | undefined;
  /** A quiet note after the title, e.g. "newest first". */
  readonly hint?: string | undefined;
  /** A line under the title saying what the section holds. */
  readonly description?: string | undefined;
  /** What sits on the right: arrows, a count tag, a note or a total. */
  readonly actions?: ReactNode;
}

const PERIOD = [
  'ml-2 rounded-full bg-mintdeep px-2.5 py-0.5 align-middle',
  'type-caption font-semibold text-mint',
].join(' ');

/**
 * Builds the classes of the period's chip.
 *
 * @param fromXl - Whether it shows only from `xl`; by default it always shows.
 * @returns The chip's classes.
 */
export const periodClasses = (fromXl = false) => (
  `${PERIOD} ${fromXl ? 'hidden xl:inline-block' : 'inline-block'}`
);

/**
 * Renders a section header.
 *
 * @param props - The title, its heading level, the optional period (and
 *   whether it shows only from `xl`), hint and description, and the actions.
 * @returns The header row.
 */
export function SectionHeader({
  title, as: Heading = 'h2', period, periodFromXl, hint, description, actions,
}: SectionHeaderProps) {
  return (
    // The mockups centre the actions on a one-line header (rails, Members) and
    // top-align them beside a title with a description under it (Payout).
    <div className={`flex justify-between gap-4 ${description ? 'items-start' : 'items-center'}`}>
      <div className="min-w-0">
        <Heading className="type-heading-sm">
          {title}
          {period && <span className={periodClasses(periodFromXl)}>{period}</span>}
          {hint && <span className="ml-1 type-body font-medium text-muted">{hint}</span>}
        </Heading>
        {description && <p className="mt-0.5 type-caption text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
