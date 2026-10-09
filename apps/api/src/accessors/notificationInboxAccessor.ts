import type { Notification } from '@financas/api-types';
import {
  and, desc, eq, inArray, isNull,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { notifications } from '../db/schema';

// NotificationInboxAccessor (A16, VBD): the in-app inbox (FR-6.10). Stores a
// notification as type + raw parameters, never display text (OQ-82); the web
// app renders and localises it. Reads are side-effect free; marking seen is its
// own operation (OQ-105).

/** A notification type in the API contract. */
export type NotificationType = Notification['type'];

/** The parameters a given notification type carries. */
export type NotificationParams<T extends NotificationType> = (
  Extract<Notification, { type: T }>['params']
);

/** A stored notification. `type` is text, so a type this build doesn't know still lists. */
export interface InboxNotification {
  readonly id: string;
  readonly type: string;
  readonly params: Record<string, unknown>;
  readonly seenAt: Date | null;
  readonly createdAt: Date;
}

const columns = {
  id: notifications.id,
  type: notifications.type,
  params: notifications.params,
  seenAt: notifications.seenAt,
  createdAt: notifications.createdAt,
};

/**
 * Builds the NotificationInboxAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createNotificationInboxAccessor = (db: Database) => ({
  /**
   * Puts a notification in a user's inbox, unseen.
   *
   * @param userId - Recipient.
   * @param type - Notification type.
   * @param params - Its raw parameters (IDs, dates, codes — never text).
   * @returns The stored notification.
   */
  insert: async <T extends NotificationType>(
    userId: string,
    type: T,
    params: NotificationParams<T>,
  ): Promise<InboxNotification> => {
    const [row] = await db.insert(notifications).values({ userId, type, params })
      .returning(columns);
    return row as InboxNotification;
  },

  /**
   * Lists a user's inbox, newest first. Changes nothing — the bell can poll it.
   *
   * @param userId - Inbox owner.
   * @returns The notifications.
   */
  listByUser: async (userId: string): Promise<InboxNotification[]> => (
    await db.select(columns).from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
  ) as InboxNotification[],

  /**
   * Marks exactly the given notifications seen — the ones the inbox showed — so
   * one that arrived meanwhile stays unseen (FR-6.10). Other users'
   * notifications and already-seen ones are left alone.
   *
   * @param userId - Inbox owner.
   * @param notificationIds - The notifications shown.
   * @param now - When they were seen.
   * @returns How many changed from unseen to seen.
   */
  markSeen: async (
    userId: string,
    notificationIds: readonly string[],
    now: Date,
  ): Promise<number> => {
    if (notificationIds.length === 0) return 0;
    const marked = await db.update(notifications).set({ seenAt: now })
      .where(and(
        eq(notifications.userId, userId),
        inArray(notifications.id, [...notificationIds]),
        isNull(notifications.seenAt),
      ))
      .returning({ id: notifications.id });
    return marked.length;
  },

  /**
   * Hard-deletes a notification if it belongs to the user — ownership check and
   * delete in one statement (FR-6.10, OQ-105).
   *
   * @param userId - Inbox owner.
   * @param notificationId - The notification.
   * @returns `true` when deleted; `false` when missing or someone else's (both → 404).
   */
  deleteForUser: async (userId: string, notificationId: string): Promise<boolean> => {
    const deleted = await db.delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    return deleted.length > 0;
  },
});

/** The NotificationInboxAccessor's operations. */
export type NotificationInboxAccessor = ReturnType<typeof createNotificationInboxAccessor>;

export default createNotificationInboxAccessor;
