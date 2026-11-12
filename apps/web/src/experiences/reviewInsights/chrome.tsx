import { createLogger } from '@financas/logging/browser';
import type { ReactNode } from 'react';
import { inbox as settings } from '../../config/constants';
import type { ShellInbox } from '../../shell/shellConfig';
import type { AppStore } from '../../store';
import { reviewInsightsApi, useListNotificationsQuery } from './api';
import { AuditLogExport } from './AuditLogExport';
import { createDialogSwitch } from './dialogSwitch';
import InboxPanel from './InboxPanel';
import { unseenIdsOf } from './inbox';

// Review Insights' parts of the App Shell's chrome (task 139, OQ-156, OQ-243),
// as the composition root hands them over: the bell's inbox — its unseen
// count, polled while the tab is in front and on focus; its panel; and the
// dismiss the shell runs once a routed action succeeded — and the audit-log
// export, the drawer's handler and the dialog it opens, mounted in the
// chrome's overlays.

const log = createLogger({ label: 'NotificationInbox' });

/** What Review Insights gives the shell. */
export interface ReviewInsightsChrome {
  readonly inbox: ShellInbox;
  /** The drawer's "Export audit log". */
  readonly exportAuditLog: () => void;
  /** What the chrome mounts over every page: the export dialog. */
  readonly overlays: ReactNode;
}

/**
 * Counts the notifications not seen yet, asking again every minute while the
 * tab is in front, and when it comes back to it.
 *
 * @returns The unseen count; 0 until the inbox is read.
 */
export const useUnseenCount = (): number => {
  const { data } = useListNotificationsQuery(undefined, {
    pollingInterval: settings.pollIntervalMs,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  return data ? unseenIdsOf(data).length : 0;
};

/**
 * Builds Review Insights' parts of the chrome over the page's store.
 *
 * @param store - The page's store, for the dismiss the shell runs outside React.
 * @returns The inbox, the export's handler and the overlays.
 */
export const createReviewInsightsChrome = (store: AppStore): ReviewInsightsChrome => {
  const dialog = createDialogSwitch();
  return {
    inbox: {
      useUnseenCount,
      Panel: InboxPanel,
      dismiss: async (notificationId) => {
        const deleting = store.dispatch(
          reviewInsightsApi.endpoints.deleteNotification.initiate(notificationId),
        );
        await deleting.unwrap().catch(() => {
          log.warn('A handled notification was not deleted', { notificationId });
        });
      },
    },
    exportAuditLog: dialog.open,
    overlays: <AuditLogExport dialog={dialog} />,
  };
};
