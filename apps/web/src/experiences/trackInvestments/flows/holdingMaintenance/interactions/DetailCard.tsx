import type { ReactNode } from 'react';
import type { IconName } from '../../../../../kit/icons/Icon';
import { Icon } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';

// The frame every card in an open holding row wears (FL19; mockup 51): a
// glyph and title, then at the end either a "read-only" / "editable" pill or
// the caller's action, over the card's content. Display only.

/** What the card's heading says at its end. */
export type DetailCardMode = 'readOnly' | 'editable';

/** Detail Card's props. */
export interface DetailCardProps {
  readonly icon: IconName;
  readonly title: string;
  /** The pill at the heading's end; none when `action` takes its place. */
  readonly mode?: DetailCardMode | undefined;
  /** What sits at the heading's end instead of the pill, e.g. a link. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

/** The pill's look per mode (mockup 51: muted for read-only, mint for editable). */
const PILLS: Record<DetailCardMode, string> = {
  readOnly: 'bg-raised text-muted',
  editable: 'bg-mint/10 text-mint',
};

/**
 * Renders one card of an open holding row.
 *
 * @param props - The glyph, title, pill or action, and content.
 * @returns The card.
 */
export function DetailCard({
  icon, title, mode, action, children,
}: DetailCardProps) {
  const translator = useI18n();
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="size-[18px] shrink-0 text-muted" />
        <h3 className="type-body-sm font-semibold">{title}</h3>
        {mode && (
          <span className={`ml-auto rounded-full px-2 py-0.5 type-caption ${PILLS[mode]}`}>
            {translator.text('holdingMaintenance', mode)}
          </span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  );
}
