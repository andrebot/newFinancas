import type { Notification, ReceivedInvitation } from '@financas/api-types';
import type { NotificationAction } from '../../shell/notificationRouting';
import { fullName } from '../../utilities/personName';

// What the Notification Inbox shows (task 139; mockup 23; FR-6.10, OQ-82,
// OQ-243). A notification carries ids, never names: an invitation is named
// from the invitations still waiting for the user — one no longer among them
// was answered, declined, revoked or expired, and shows only that; a matured
// Holding by the ticker or type it was sent with — one missing its Holding or
// due date reads as any other. A type this build doesn't know shows the
// generic line. Pure, so it tests without React.

/** What one notification says, by what the app knows of it. */
export type InboxNotice = | {
  readonly kind: 'invitation';
  /** Undefined when the inviter's account is gone — "Someone" (OQ-82). */
  readonly inviterName: string | undefined;
  readonly householdName: string;
  readonly role: ReceivedInvitation['role'];
}
  | { readonly kind: 'staleInvitation' }
  | {
    readonly kind: 'matured';
    readonly holdingId: string;
    readonly ticker: string | null;
    readonly assetType: string | undefined;
    readonly dueDate: string;
  }
  | { readonly kind: 'other' };

/** One row of the inbox. */
export interface InboxEntry {
  readonly id: string;
  /** ISO 8601. */
  readonly createdAt: string;
  /** Whether it was unseen when the inbox opened: it shows as new, not as seen. */
  readonly fresh: boolean;
  readonly notice: InboxNotice;
}

/** A stored notification as the inbox reads it: any type, even one this build doesn't know. */
interface StoredNotification {
  readonly id?: string | undefined;
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seenAt?: string | null | undefined;
  readonly createdAt?: string | undefined;
}

/**
 * Reads a param as text.
 *
 * @param params - The notification's params.
 * @param key - The param.
 * @returns Its text, or undefined when it isn't one.
 */
const textParam = (params: Readonly<Record<string, unknown>>, key: string) => {
  const value = params[key];
  return typeof value === 'string' ? value : undefined;
};

/**
 * Names an invitation from the ones still waiting.
 *
 * @param params - The notification's params.
 * @param invitations - The invitations waiting for the user.
 * @returns The notice; stale when the invitation no longer waits.
 */
const invitationNoticeOf = (
  params: Readonly<Record<string, unknown>>,
  invitations: readonly ReceivedInvitation[],
): InboxNotice => {
  const invitation = invitations.find(({ id }) => id === textParam(params, 'invitationId'));
  if (!invitation) return { kind: 'staleInvitation' };
  const inviterName = invitation.inviterFirstName === null ? undefined : fullName({
    firstName: invitation.inviterFirstName, lastName: invitation.inviterLastName ?? '',
  });
  return {
    kind: 'invitation',
    inviterName,
    householdName: invitation.householdName,
    role: invitation.role,
  };
};

/**
 * Reads what a notification says.
 *
 * @param notification - The stored notification.
 * @param invitations - The invitations waiting for the user.
 * @returns The notice.
 */
export const noticeOf = (
  notification: StoredNotification,
  invitations: readonly ReceivedInvitation[],
): InboxNotice => {
  const { params } = notification;
  if (notification.type === 'invitation.received') return invitationNoticeOf(params, invitations);
  const holdingId = textParam(params, 'holdingId');
  const dueDate = textParam(params, 'dueDate');
  if (notification.type !== 'holding.matured' || !holdingId || !dueDate) return { kind: 'other' };
  return {
    kind: 'matured',
    holdingId,
    ticker: textParam(params, 'ticker') ?? null,
    assetType: textParam(params, 'assetType'),
    dueDate,
  };
};

/**
 * The ids of the notifications not seen yet.
 *
 * @param notifications - The inbox, as listed.
 * @returns Their ids, in the inbox's order.
 */
export const unseenIdsOf = (notifications: readonly Notification[]): string[] => (
  notifications.flatMap(({ id, seenAt }) => (id !== undefined && !seenAt ? [id] : []))
);

/**
 * Builds the inbox's rows, newest first as listed.
 *
 * @param notifications - The inbox, as listed.
 * @param invitations - The invitations waiting for the user.
 * @param freshIds - The notifications unseen when the inbox opened.
 * @returns The rows; a notification without an id is left out.
 */
export const entriesOf = (
  notifications: readonly Notification[],
  invitations: readonly ReceivedInvitation[],
  freshIds: readonly string[],
): InboxEntry[] => notifications.flatMap((notification) => {
  const stored = notification as StoredNotification;
  if (stored.id === undefined) return [];
  return [{
    id: stored.id,
    createdAt: stored.createdAt ?? '',
    fresh: freshIds.includes(stored.id),
    notice: noticeOf(stored, invitations),
  }];
});

/**
 * Builds the action the shell routes to the Experience owning the notification.
 *
 * @param notification - The notification acted on.
 * @param action - What was picked: `accept`, `decline` or `archive`.
 * @returns The routed action.
 */
export const actionOf = (notification: Notification, action: string): NotificationAction => ({
  notificationId: notification.id ?? '',
  type: notification.type,
  action,
  params: notification.params,
});
