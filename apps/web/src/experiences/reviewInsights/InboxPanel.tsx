import type { Notification, ReceivedInvitation } from '@financas/api-types';
import { createLogger } from '@financas/logging/browser';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useListHouseholdsQuery, useListMyInvitationsQuery } from '../../api/identityApi';
import { inbox as settings } from '../../config/constants';
import type { InboxPanelProps } from '../../shell/shellConfig';
import { switchHousehold } from '../../shell/shellState';
import { useAppDispatch } from '../../store';
import { useAlerts } from '../../utilities/AlertProvider';
import { useI18n } from '../../utilities/I18nProvider';
import holdingLinkOf from '../holdingLink';
import {
  useDeleteNotificationMutation, useListNotificationsQuery, useMarkNotificationsSeenMutation,
} from './api';
import {
  actionOf, entriesOf, noticeOf, unseenIdsOf,
} from './inbox';
import { NotificationInbox, type InboxRead } from './interactions/NotificationInbox';

// The bell's panel (task 139; mockup 23; FR-6.10, OQ-105, OQ-243): Review
// Insights' Notification Inbox, which the App Shell hosts. It reads the inbox
// and the invitations that name its invitation notices, and once both are in,
// marks exactly the notifications it showed unseen as seen — those stay "new"
// while it is open. Accept, Decline and Archive go to the shell, which hands
// them to the Experience owning the notification and deletes it once that
// succeeds; View holding opens the Holding in Investments, in the household
// the notice names (OQ-245) — one the user still belongs to; delete is the
// inbox's own. Switching is the shell's thunk, which Experiences dispatch as
// Onboard and Manage Household do. A row whose action is running is disabled.

const log = createLogger({ label: 'NotificationInbox' });

/** The part of an RTK Query hook's result the inbox is read from. */
interface ReadState<Data> {
  readonly data?: Data | undefined;
  readonly isError: boolean;
}

/**
 * Reads the inbox as the Interaction takes it: loaded once the notifications
 * and the invitations are in and the panel knows what it opened with.
 *
 * @param notifications - The inbox's read.
 * @param invitations - The invitations' read.
 * @param freshIds - The notifications unseen when the panel opened; undefined until then.
 * @returns The inbox's read.
 */
export const inboxReadOf = (
  notifications: ReadState<readonly Notification[]>,
  invitations: ReadState<readonly ReceivedInvitation[]>,
  freshIds: readonly string[] | undefined,
): InboxRead => {
  if (notifications.data && invitations.data && freshIds) {
    return { status: 'loaded', entries: entriesOf(notifications.data, invitations.data, freshIds) };
  }
  const failed = notifications.isError || invitations.isError;
  return failed ? { status: 'failed' } : { status: 'loading' };
};

/**
 * Marks the notifications the panel opened with as seen, once: the first time
 * both reads are in. Ids go in batches the contract takes; a failure only
 * leaves the badge as it was.
 *
 * @param listed - The inbox, once listed.
 * @param ready - Whether the invitations are in too.
 * @returns The notifications unseen when the panel opened; undefined until then.
 */
const useMarkShownSeen = (listed: readonly Notification[] | undefined, ready: boolean) => {
  const [freshIds, setFreshIds] = useState<readonly string[]>();
  const [markSeen] = useMarkNotificationsSeenMutation();
  // What the panel opened with is taken once, as it renders, and kept.
  if (ready && freshIds === undefined && listed !== undefined) setFreshIds(unseenIdsOf(listed));
  useEffect(() => {
    if (freshIds === undefined) return;
    for (let start = 0; start < freshIds.length; start += settings.markSeenBatch) {
      markSeen(freshIds.slice(start, start + settings.markSeenBatch)).unwrap().catch(() => {
        log.warn('Notifications not marked seen');
      });
    }
  }, [freshIds, markSeen]);
  return freshIds;
};

/**
 * Holds which rows' work is running, disabling each meanwhile — one row's
 * end never re-enables another still running (PR #172 review).
 *
 * @returns The busy rows and the runner.
 */
const useBusyRows = () => {
  const [busyIds, setBusyIds] = useState<readonly string[]>([]);

  /**
   * Runs one row's work with the row disabled.
   *
   * @param id - The notification.
   * @param work - What to run.
   */
  const busyWith = (id: string, work: () => Promise<void>) => {
    setBusyIds((running) => [...running, id]);
    work().finally(() => setBusyIds((running) => running.filter((busy) => busy !== id)));
  };

  return { busyIds, busyWith };
};

/**
 * Whether a notice names a household the user no longer belongs to.
 *
 * @param householdId - The notice's household; undefined for one sent without it.
 * @param households - The user's households, once listed.
 * @returns True when it names one they aren't in (or the list isn't in yet).
 */
export const namesHouseholdLeft = (
  householdId: string | undefined,
  households: readonly { readonly id?: string }[] | undefined,
) => householdId !== undefined && !households?.some((home) => home.id === householdId);

/**
 * Renders the inbox in the bell's panel.
 *
 * @param props - The panel's close and the shell's action router.
 * @returns The inbox.
 */
export default function InboxPanel({ close, onAction }: InboxPanelProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [now] = useState(() => new Date());
  const notifications = useListNotificationsQuery();
  const invitations = useListMyInvitationsQuery();
  const households = useListHouseholdsQuery();
  const [deleteNotification] = useDeleteNotificationMutation();
  const freshIds = useMarkShownSeen(notifications.data, invitations.data !== undefined);
  const { busyIds, busyWith } = useBusyRows();
  const find = (id: string) => notifications.data?.find((notification) => notification.id === id);

  /**
   * Hands an action to the shell, telling the user when no Experience owns it;
   * the owning Experience shows its own errors.
   *
   * @param id - The notification.
   * @param action - `accept`, `decline` or `archive`.
   */
  const route = (id: string, action: string) => {
    const notification = find(id);
    if (!notification) return;
    busyWith(id, async () => {
      const outcome = await onAction(actionOf(notification, action));
      if (outcome === 'unrouted') alerts.error(translator.text('inbox', 'unrouted'));
    });
  };

  /**
   * Opens a matured Holding in Investments, closing the panel; first switches
   * to the Holding's household when the notice names another (OQ-245). A
   * household the user no longer belongs to is not switched to — the gate
   * would move them elsewhere — the toast says so instead (PR #174 review).
   *
   * @param id - The notification.
   */
  const view = (id: string) => {
    const notification = find(id);
    const notice = notification && noticeOf(notification, []);
    if (notice?.kind !== 'matured') return;
    const { householdId } = notice;
    if (namesHouseholdLeft(householdId, households.data)) {
      alerts.error(translator.text('inbox', 'notMember'));
      return;
    }
    close();
    if (householdId !== undefined) dispatch(switchHousehold(householdId));
    navigate(holdingLinkOf(notice.holdingId));
  };

  return (
    <NotificationInbox
      read={inboxReadOf(notifications, invitations, freshIds)}
      now={now}
      busyIds={busyIds}
      onRetry={() => {
        [notifications, invitations].forEach((query) => {
          if (query.isError) query.refetch();
        });
      }}
      onAnswer={route}
      onArchive={(id) => route(id, 'archive')}
      onView={view}
      onDelete={(id) => busyWith(id, () => deleteNotification(id).unwrap().catch(() => {
        alerts.error(translator.text('inbox', 'deleteFailed'));
      }))}
    />
  );
}
