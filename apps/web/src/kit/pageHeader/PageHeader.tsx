import type { ReactNode } from 'react';

// The kit's page header (K34, OQ-135): the top of every App Shell page — an
// optional eyebrow naming the Experience ("Account Setup"), the page's `h1`,
// a description, the page's actions and, under them, the tabs that switch
// between its Flows. Texts arrive translated.

/** The page header's props. */
export interface PageHeaderProps {
  readonly title: string;
  /** The Experience the page belongs to, e.g. "Account Setup". */
  readonly eyebrow?: string | undefined;
  /** What the page is for, or a summary such as "4 members". */
  readonly description?: string | undefined;
  /** What precedes the title, e.g. the profile's large avatar. */
  readonly leading?: ReactNode;
  /** The page's buttons, e.g. "Add Account". */
  readonly actions?: ReactNode;
  /** The tabs between the page's sections. */
  readonly tabs?: ReactNode;
}

/**
 * Renders a page header.
 *
 * @param props - The title, the optional eyebrow and description, and the
 *   leading, actions and tabs slots.
 * @returns The header block.
 */
export function PageHeader({
  title, eyebrow, description, leading, actions, tabs,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 items-center gap-5">
          {leading}
          <div className="min-w-0">
            {eyebrow && <p className="type-label text-muted">{eyebrow}</p>}
            <h1 className="mt-1 type-display-lg first:mt-0">{title}</h1>
            {description && <p className="mt-1 type-body text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 gap-3">{actions}</div>}
      </div>
      {tabs && <div>{tabs}</div>}
    </header>
  );
}
