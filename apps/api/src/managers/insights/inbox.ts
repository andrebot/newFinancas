import type { InboxNotification } from '../../accessors/notificationInboxAccessor';
import type { SignedInContext } from '../requestContext';
import type { InsightsDeps } from './context';
import { notificationNotFound } from './errors';

// The Notification Inbox (FR-6.10, OQ-45, OQ-105) on `/notifications`: the
// signed-in user's own, in no household. Listing changes nothing, so the bell
// can poll it for the unseen count; opening the inbox marks exactly what it
// showed as seen; deleting is a hard delete. Ownership is the Accessor's single
// statement, so someone else's notification is the same 404 as a missing one.

/**
 * Builds the inbox use cases.
 *
 * @param deps - The tier below.
 * @returns `listNotifications`, `markNotificationsSeen` and `deleteNotification`.
 */
export const createInbox = (deps: InsightsDeps) => ({
  /**
   * The user's inbox, newest first; reading it marks nothing.
   *
   * @param context - The signed-in request.
   * @returns The notifications, types this build doesn't know included.
   */
  listNotifications: (context: SignedInContext): Promise<InboxNotification[]> => (
    deps.notifications.listByUser(context.actor.userId)
  ),

  /**
   * Marks the notifications the inbox showed as seen. Ids that are someone
   * else's, unknown or already seen are ignored — nothing is revealed.
   *
   * @param context - The signed-in request.
   * @param notificationIds - The notifications shown.
   */
  markNotificationsSeen: async (
    context: SignedInContext,
    notificationIds: readonly string[],
  ): Promise<void> => {
    await deps.notifications.markSeen(context.actor.userId, notificationIds, deps.now());
  },

  /**
   * Deletes one of the user's notifications for good.
   *
   * @param context - The signed-in request.
   * @param notificationId - The notification.
   * @throws {DomainError} `notification.not_found` — missing or someone else's.
   */
  deleteNotification: async (context: SignedInContext, notificationId: string): Promise<void> => {
    const deleted = await deps.notifications.deleteForUser(context.actor.userId, notificationId);
    if (!deleted) throw notificationNotFound();
  },
});

export type Inbox = ReturnType<typeof createInbox>;
