import type { ReactNode } from 'react';
import { Icon } from '../../../../../kit/icons/Icon';

// A row for something already set up during the wizard (FL6, mockup 13): a
// mint check, what it is and a line about it, and an optional action at the
// end (the budget's Edit). The account step lists its accounts the same way.

/** SetupDoneRow's props. */
export interface SetupDoneRowProps {
  /** Already translated, e.g. "Fun Money · $300.00 / month". */
  readonly title: string;
  /** The muted line under it, already translated. */
  readonly detail?: string | undefined;
  /** What sits at the end, e.g. an Edit button. */
  readonly trailing?: ReactNode;
}

/**
 * Renders one done row.
 *
 * @param props - Its texts and its action.
 * @returns The row.
 */
export function SetupDoneRow({ title, detail, trailing }: SetupDoneRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3">
      <Icon name="check-circle" className="size-5.5 shrink-0 text-mint" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-body-sm font-semibold">{title}</span>
        {detail && <span className="type-caption text-muted">{detail}</span>}
      </div>
      {trailing}
    </li>
  );
}
