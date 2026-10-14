import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';

// The kit's empty state (K28, OQ-132): what a list or panel shows when it has
// nothing to list — "No transactions yet", "No results for these filters". An
// icon in a raised circle, a title, an optional quieter line and an optional
// action, centred in the space the content would fill.

/** The empty state's props. */
export interface EmptyStateProps {
  /** A glyph hinting at what's missing (e.g. `receipt-long-outline`). */
  readonly icon: IconName;
  /** What's missing, already translated. */
  readonly title: string;
  /** What the user can do about it, already translated. */
  readonly description?: string | undefined;
  /** A way forward, e.g. a "Record" or "Clear filters" button. */
  readonly action?: ReactNode;
}

/**
 * Renders the empty state.
 *
 * @param props - The icon, the texts and the optional action.
 * @returns The centred empty-state block.
 */
export function EmptyState({
  icon, title, description, action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-full bg-raised text-muted">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="type-heading-sm">{title}</p>
      {description && <p className="max-w-xs type-body-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
