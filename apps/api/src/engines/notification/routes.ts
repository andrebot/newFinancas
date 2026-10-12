import type { EmailType, Locale } from '@financas/i18n';
import type {
  NotificationParams, NotificationType,
} from '../../accessors/notificationInboxAccessor';
import type { EmailParams } from './emails';

// The notification routing table (OQ-113): the Engine, not the Manager, decides
// which channels a notification type reaches. Emailing invitations too would be
// one entry here. The types derive from the table what a Manager must supply.

/** Where a notification can go. */
export type Channel = 'in_app' | 'email';

/** Every notification the app sends: inbox types (API contract) and email types (catalog). */
export type NotificationKind = NotificationType | EmailType;

/** Channels a kind can use: in-app needs an inbox type, email needs a catalog email. */
type ChannelsFor<K extends NotificationKind> = | (K extends NotificationType ? 'in_app' : never)
  | (K extends EmailType ? 'email' : never);

/** The routing table, v1 (OQ-68: notifications in-app; email only for password reset, OQ-84). */
export const ROUTES = {
  'invitation.received': ['in_app'],
  'holding.matured': ['in_app'],
  'password.reset': ['email'],
} as const satisfies { readonly [K in NotificationKind]: readonly ChannelsFor<K>[] };

type Routes = typeof ROUTES;

/** What each channel needs to know about the person. */
interface RecipientByChannel {
  readonly in_app: { readonly userId: string };
  readonly email: { readonly email: string; readonly language: Locale };
}

/** Turns a union into an intersection: every routed channel's needs, together. */
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  (value: infer I) => void
) ? I : never;

/** The recipient a kind needs — everything its channels need (e.g. `{ userId }`). */
export type Recipient<K extends NotificationKind> = UnionToIntersection<
  RecipientByChannel[Routes[K][number]]
>;

type InboxParams<K> = K extends NotificationType ? NotificationParams<K> : unknown;
type TemplateArgs<K> = K extends EmailType ? EmailParams[K] : unknown;

/** The parameters a kind carries: its inbox params and/or its email template arguments. */
export type Params<K extends NotificationKind> = InboxParams<K> & TemplateArgs<K>;
