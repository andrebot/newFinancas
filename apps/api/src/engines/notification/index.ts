import type { EmailType, Locale } from '@financas/i18n';
import type { EmailAccessor } from '../../accessors/emailAccessor';
import type {
  NotificationInboxAccessor, NotificationType,
} from '../../accessors/notificationInboxAccessor';
import { type EmailParams, renderEmail } from './emails';
import {
  type Channel, type NotificationKind, type Params, type Recipient, ROUTES,
} from './routes';

// NotificationEngine (U7, VBD §2.2, OQ-113): turns "this happened, tell this
// person" into a delivered notification. Only Managers call it. The Manager says
// the kind, recipient and parameters — never text (OQ-82), never the channel:
// the routing table picks the channels; in-app stores type + params, email is
// rendered here from the shared catalog and sent through EmailAccessor.

export type {
  Channel, NotificationKind, Params, Recipient,
} from './routes';
export { ROUTES } from './routes';
export { type EmailParams, renderEmail } from './emails';

/** What the Engine reaches: the inbox and the email sender. */
export interface NotificationEngineDeps {
  readonly insertNotification: NotificationInboxAccessor['insert'];
  readonly sendEmail: EmailAccessor['send'];
}

/** A recipient as the channels read it; the public types guarantee each channel's part. */
interface AnyRecipient {
  readonly userId: string;
  readonly email: string;
  readonly language: Locale;
}

/**
 * Creates the notification engine.
 *
 * @param deps - Inbox and email sender.
 * @returns `notify`.
 */
export const createNotificationEngine = (deps: NotificationEngineDeps) => {
  const deliverTo: Record<Channel, (
    kind: NotificationKind, recipient: AnyRecipient, params: object,
  ) => Promise<unknown>> = {
    in_app: (kind, recipient, params) => deps.insertNotification(
      recipient.userId,
      kind as NotificationType,
      params,
    ),
    email: (kind, recipient, params) => {
      const { subject, body } = renderEmail(
        kind as EmailType,
        params as EmailParams[EmailType],
        recipient.language,
      );
      return deps.sendEmail({ to: recipient.email, subject, body });
    },
  };

  return {
    /**
     * Notifies someone that something happened, through every channel the
     * kind is routed to.
     *
     * @param kind - What happened, e.g. `password.reset`.
     * @param recipient - Who; its shape follows from the kind's channels.
     * @param params - Raw parameters (IDs, dates, codes) — never text.
     * @returns Resolves once every channel delivered; rejects if any failed.
     */
    notify: async <K extends NotificationKind>(
      kind: K,
      recipient: Recipient<K>,
      params: Params<K>,
    ): Promise<void> => {
      const channels: readonly Channel[] = ROUTES[kind];
      await Promise.all(channels.map((channel) => (
        deliverTo[channel](kind, recipient as unknown as AnyRecipient, params as object)
      )));
    },
  };
};

export type NotificationEngine = ReturnType<typeof createNotificationEngine>;
