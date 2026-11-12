import type { ReactNode } from 'react';
import { InlineBanner } from '../../../kit/alert/InlineBanner';
import { Button } from '../../../kit/button/Button';
import { IconButton } from '../../../kit/button/IconButton';
import { Icon } from '../../../kit/icons/Icon';
import type { IconName } from '../../../kit/icons/generated/iconData';
import { SkeletonRows } from '../../../kit/skeleton/Skeleton';
import { useI18n } from '../../../utilities/I18nProvider';
import type { Translator } from '../../../utilities/i18n';
import useFormatter from '../../../utilities/useFormatter';
import type { Formatter } from '../../../utilities/formatting';
import { assetTypeName } from '../../holdingNames';
import type { InboxEntry, InboxNotice } from '../inbox';

// The Notification Inbox (task 139; mockup 23; FR-6.10, OQ-243): the bell's
// panel — how many arrived since it was last opened, then each notification,
// newest first: an invitation with Accept and Decline, a matured Holding with
// Archive holding and View holding, and a delete on every row. Rows already
// seen before the panel opened are dimmed, "Seen · 3 days ago". Display only:
// the Experience reads the inbox and answers every event; a row whose action
// is running is disabled.

/** The inbox, as the Experience holds it. */
export type InboxRead = | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'loaded'; readonly entries: readonly InboxEntry[] };

/** An answer to an invitation. */
export type InvitationAnswer = 'accept' | 'decline';

/** The Notification Inbox's props. */
export interface NotificationInboxProps {
  readonly read: InboxRead;
  /** The moment the times are told from. */
  readonly now: Date;
  /** The row whose action is running, if any. */
  readonly busyId: string | undefined;
  readonly onRetry: () => void;
  readonly onAnswer: (notificationId: string, answer: InvitationAnswer) => void;
  readonly onArchive: (notificationId: string) => void;
  readonly onView: (notificationId: string) => void;
  readonly onDelete: (notificationId: string) => void;
}

/** A row's handlers, bound to its notification. */
type RowEvents = Pick<NotificationInboxProps, 'onAnswer' | 'onArchive' | 'onView'>;

/** Each notice's badge: its glyph and tint (mockup 23). */
const BADGES: Readonly<Record<InboxNotice['kind'], { icon: IconName; tint: string }>> = {
  invitation: { icon: 'mail-outline', tint: 'bg-sky/15 text-sky' },
  staleInvitation: { icon: 'mail-outline', tint: 'bg-ink/5 text-muted' },
  matured: { icon: 'event-available-outline', tint: 'bg-sun/15 text-sun' },
  other: { icon: 'notifications-outline', tint: 'bg-ink/5 text-muted' },
};

/** A row's frame (mockup 23). */
const ROW = 'flex gap-3 border-b border-line/70 px-4 py-3 last:border-b-0';

/**
 * Words what a notice says.
 *
 * @param notice - The notice.
 * @param translator - The texts.
 * @param formatter - For the due date.
 * @returns Its line.
 */
export const noticeText = (notice: InboxNotice, translator: Translator, formatter: Formatter) => {
  switch (notice.kind) {
    case 'invitation':
      return translator.notification('invitation.received', {
        inviterName: notice.inviterName ?? translator.text('inbox', 'someone'),
        householdName: notice.householdName,
        role: notice.role,
      });
    case 'staleInvitation':
      return translator.text('inbox', 'stale');
    case 'matured':
      return translator.notification('holding.matured', {
        name: notice.ticker ?? assetTypeName(translator, notice.assetType),
        dueDate: formatter.date(notice.dueDate),
      });
    default:
      return translator.text('notifications', 'fallback');
  }
};

/**
 * Renders a row's action buttons: an invitation's answers, a matured Holding's
 * archive and view; nothing for the rest.
 *
 * @param props - The row, whether it is busy and its handlers.
 * @returns The buttons, if any.
 */
function RowActions({
  entry, busy, onAnswer, onArchive, onView,
}: RowEvents & { readonly entry: InboxEntry; readonly busy: boolean }) {
  const translator = useI18n();
  const text = (key: 'accept' | 'decline' | 'archive' | 'view') => translator.text('inbox', key);
  const look = { size: 'sm', disabled: busy } as const;
  let buttons: ReactNode = null;
  if (entry.notice.kind === 'invitation') {
    buttons = (
      <>
        <Button {...look} variant="primary" onClick={() => onAnswer(entry.id, 'accept')}>
          {text('accept')}
        </Button>
        <Button {...look} variant="ghost" onClick={() => onAnswer(entry.id, 'decline')}>
          {text('decline')}
        </Button>
      </>
    );
  } else if (entry.notice.kind === 'matured') {
    buttons = (
      <>
        <Button {...look} variant="secondary" onClick={() => onArchive(entry.id)}>
          {text('archive')}
        </Button>
        <Button {...look} variant="ghost" onClick={() => onView(entry.id)}>
          {text('view')}
        </Button>
      </>
    );
  }
  return buttons && <div className="mt-2 flex flex-wrap gap-2">{buttons}</div>;
}

/**
 * Renders one notification.
 *
 * @param props - The row, the moment times are told from, whether it is busy
 *   and its handlers.
 * @returns The row.
 */
function InboxRow({
  entry, now, busy, onDelete, ...events
}: RowEvents & Pick<NotificationInboxProps, 'onDelete'> & {
  readonly entry: InboxEntry;
  readonly now: Date;
  readonly busy: boolean;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  const badge = BADGES[entry.notice.kind];
  const time = entry.createdAt ? formatter.relativeTime(entry.createdAt, now) : '';
  return (
    <li className={`${ROW} ${entry.fresh ? '' : 'opacity-60'}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${badge.tint}`}>
        <Icon name={badge.icon} className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-body-sm">{noticeText(entry.notice, translator, formatter)}</p>
        <p className="type-caption mt-0.5 text-faint">
          {entry.fresh ? time : translator.text('inbox', 'seen', { time })}
        </p>
        <RowActions entry={entry} busy={busy} {...events} />
      </div>
      <IconButton
        icon="close"
        size="xs"
        label={translator.text('inbox', 'delete')}
        disabled={busy}
        onClick={() => onDelete(entry.id)}
      />
    </li>
  );
}

/**
 * Renders the inbox's body for its state: placeholders, a failure with Try
 * again, an "all caught up" line, or the rows.
 *
 * @param props - The Interaction's props.
 * @returns The body.
 */
function InboxBody({
  read, now, busyId, onRetry, onDelete, ...events
}: NotificationInboxProps) {
  const translator = useI18n();
  if (read.status === 'loading') {
    return <SkeletonRows label={translator.text('inbox', 'loading')} />;
  }
  if (read.status === 'failed') {
    return (
      <div className="p-4">
        <InlineBanner
          tone="error"
          message={translator.text('inbox', 'failed')}
          action={(
            <Button variant="ghost" onClick={onRetry}>{translator.text('inbox', 'retry')}</Button>
          )}
        />
      </div>
    );
  }
  if (read.entries.length === 0) {
    return (
      <p className="type-body-sm px-4 py-6 text-center text-muted">
        {translator.text('inbox', 'empty')}
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {read.entries.map((entry) => (
        <InboxRow
          key={entry.id}
          entry={entry}
          now={now}
          busy={busyId === entry.id}
          onDelete={onDelete}
          {...events}
        />
      ))}
    </ul>
  );
}

/**
 * Renders the inbox: its heading with how many are new, then its body.
 *
 * @param props - The inbox, the moment times are told from, the busy row and the handlers.
 * @returns The panel's content.
 */
export function NotificationInbox(props: NotificationInboxProps) {
  const translator = useI18n();
  const { read } = props;
  const freshCount = read.status === 'loaded'
    ? read.entries.filter((entry) => entry.fresh).length
    : 0;
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="type-heading-sm">{translator.text('inbox', 'title')}</h2>
        {freshCount > 0 && (
          <span className="type-caption text-muted">
            {translator.text('inbox', 'newSeen', { count: freshCount })}
          </span>
        )}
      </div>
      <InboxBody {...props} />
    </div>
  );
}
