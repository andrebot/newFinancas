import type { NotificationType } from '@financas/i18n';

// Notification routing (S1, OQ-156; sequence
// `ebd-sequences/app-shell-notification-routing.html`). The inbox (Review
// Insights) never acts on a notification itself: it emits the action, and the
// shell hands it to the Experience that owns that type — Respond to
// Invitation (Manage Profile) for `invitation.received`, Archive Matured
// Holding (Track Investments) for `holding.matured`. The notification is
// dismissed only once that Experience reports success. The table is
// configuration: a new type is one entry plus one catalog string.

/** A user's action on one notification, as the inbox emits it. */
export interface NotificationAction {
  readonly notificationId: string;
  readonly type: string;
  /** What was picked, e.g. `accept`, `decline`, `archive`. */
  readonly action: string;
  /** The notification's params, e.g. `{ invitationId }`. */
  readonly params: Readonly<Record<string, unknown>>;
}

/** How the owning Experience's handler ended. */
export type HandlerOutcome = 'done' | 'failed';

/** What became of a routed action; `unrouted` when no Experience owns its type. */
export type RoutingOutcome = HandlerOutcome | 'unrouted';

/** The owning Experience's handler; it shows its own errors. */
export type NotificationHandler = (action: NotificationAction) => Promise<HandlerOutcome>;

/** The routing table: notification type → the owning Experience's handler. */
export type NotificationRoutes = Partial<Record<NotificationType, NotificationHandler>>;

/**
 * Finds the handler that owns a notification's type.
 *
 * @param routes - The routing table.
 * @param type - The notification's type, as the API sent it.
 * @returns The handler, or `undefined` for a type no Experience owns.
 */
export const handlerFor = (routes: NotificationRoutes, type: string) => (
  Object.hasOwn(routes, type) ? routes[type as NotificationType] : undefined
);

/**
 * Hands an action to the Experience that owns it, then dismisses the
 * notification if that Experience succeeded.
 *
 * @param routes - The routing table.
 * @param dismiss - Deletes the notification (the inbox owner's call).
 * @param action - The user's action.
 * @returns What became of it. An unknown type routes nowhere.
 */
export const routeNotificationAction = async (
  routes: NotificationRoutes,
  dismiss: (notificationId: string) => Promise<void>,
  action: NotificationAction,
): Promise<RoutingOutcome> => {
  const handler = handlerFor(routes, action.type);
  if (!handler) {
    return 'unrouted';
  }
  const outcome = await handler(action);
  if (outcome === 'done') {
    await dismiss(action.notificationId);
  }
  return outcome;
};
