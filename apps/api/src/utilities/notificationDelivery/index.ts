import type { EmailType, Locale } from '@financas/i18n';
import type {
  NotificationInboxAccessor, NotificationParams, NotificationType,
} from '../../accessors/notificationInboxAccessor';
import { type EmailParams, renderEmail } from './emails';
import type { EmailProvider } from './providers';

// NotificationDeliveryUtility (U7, VBD): delivers a notification — type +
// parameters, never text (OQ-82) — through a channel. In-app stores it in the
// inbox; email (v1: transactional auth email only) renders it from the shared
// catalog in the recipient's language and hands it to the configured provider
// (OQ-84). Delivery rejects on failure; the calling Manager decides what follows.

export type { EmailParams, RenderedEmail } from './emails';
export { renderEmail } from './emails';
export type {
  EmailMessage, EmailProvider, EmailProviderName,
} from './providers';
export { createConsoleEmailProvider, createEmailProvider, EMAIL_PROVIDERS } from './providers';

/** An in-app notification for one user. */
export type InAppDelivery = {
  [T in NotificationType]: {
    readonly channel: 'in_app';
    readonly userId: string;
    readonly type: T;
    readonly params: NotificationParams<T>;
  };
}[NotificationType];

/** An email to one address, in the recipient's language. */
export type EmailDelivery = {
  [T in EmailType]: {
    readonly channel: 'email';
    readonly to: string;
    readonly language: Locale;
    readonly type: T;
    readonly params: EmailParams[T];
  };
}[EmailType];

export type Delivery = InAppDelivery | EmailDelivery;

/** What the utility needs: the inbox, and the configured email provider. */
export interface NotificationDeliveryDeps {
  readonly insertNotification: NotificationInboxAccessor['insert'];
  readonly email: EmailProvider;
}

/**
 * Creates the notification delivery utility.
 *
 * @param deps - Inbox and email provider.
 * @returns `deliver`.
 */
export const createNotificationDeliveryUtility = (deps: NotificationDeliveryDeps) => ({
  /**
   * Delivers a notification through its channel.
   *
   * @param delivery - Channel, recipient, type and parameters.
   * @returns Resolves once stored or sent; rejects when it could not be.
   */
  deliver: async (delivery: Delivery): Promise<void> => {
    if (delivery.channel === 'in_app') {
      await deps.insertNotification(delivery.userId, delivery.type, delivery.params);
      return;
    }
    const { subject, body } = renderEmail(delivery.type, delivery.params, delivery.language);
    await deps.email.send({ to: delivery.to, subject, body });
  },
});

export type NotificationDeliveryUtility = ReturnType<typeof createNotificationDeliveryUtility>;
