import type { Locale } from '@financas/i18n';
import type { ComponentType, ReactNode } from 'react';
import type { ThemeController, ThemePreference } from '../utilities/theme';
import type { NotificationAction, NotificationRoutes, RoutingOutcome } from './notificationRouting';
import type { RouteId } from './routes';
import type { SourceState } from '../utilities/sourceState';

// What the App Shell is configured with (S1, OQ-156). The shell is a layout,
// not an Experience: it never calls the backend. The data its chrome shows
// comes as hooks the composition root (`App.tsx`) hands in — the signed-in
// user and the households from the shared identity reads (`api/identityApi.ts`,
// OQ-163), what Manage Profile and Review Insights own from them. Its events go
// back the same way: a page change through the routing table, anything else
// to the owning Experience's handler. A new Experience changes this
// configuration, never the shell.

/** A household role (FR-1.6). */
export type HouseholdRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';

/** The signed-in user, as the drawer shows them; their saved preferences apply on load. */
export interface ShellIdentity {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly theme?: ThemePreference | undefined;
  readonly language?: Locale | undefined;
}

/** One household the user belongs to, with their role in it (OQ-116). */
export interface ShellHousehold {
  readonly id: string;
  readonly name: string;
  readonly role: HouseholdRole;
}

/** The chrome's data, each hook from the Experience that owns it. */
export interface ShellSources {
  /** Manage Profile: `GET /users/me`. */
  readonly useIdentity: () => SourceState<ShellIdentity>;
  /** The shared identity reads: `GET /households`. */
  readonly useHouseholds: () => SourceState<readonly ShellHousehold[]>;
  /** Manage Profile: invitations waiting for the user's answer (`GET /users/me/invitations`). */
  readonly usePendingInvitationCount: () => number;
}

/** Chrome events that aren't a page change, each to the Experience that owns it. */
export interface ShellActions {
  /** Authenticate's Sign Out. */
  readonly signOut: () => void;
  /** Review Insights' Export Audit Log dialog (Owner/Admin only). */
  readonly exportAuditLog: () => void;
}

/** What the bell's panel gets from the shell. */
export interface InboxPanelProps {
  /** Closes the panel. */
  readonly close: () => void;
  /** Routes an action on a notification to the Experience that owns it. */
  readonly onAction: (action: NotificationAction) => Promise<RoutingOutcome>;
}

/** Review Insights' Notification Inbox, hosted by the bell. */
export interface ShellInbox {
  /** How many notifications the user hasn't seen. */
  readonly useUnseenCount: () => number;
  /** The panel the bell opens. */
  readonly Panel: ComponentType<InboxPanelProps>;
  /** Deletes a notification once its action is done (`DELETE /notifications/:id`). */
  readonly dismiss: (notificationId: string) => Promise<void>;
}

/** The shell's whole configuration. */
export interface ShellConfig {
  /** Each page's element, by route id; the routing table says who may open it. */
  readonly pages: Readonly<Record<RouteId, ReactNode>>;
  readonly sources: ShellSources;
  readonly actions: ShellActions;
  /** The bell and its inbox; no bell until Review Insights provides one. */
  readonly inbox?: ShellInbox | undefined;
  /** Notification type → the owning Experience's handler. */
  readonly notificationRoutes: NotificationRoutes;
  /** The page's theme controller, to apply the user's saved theme. */
  readonly themeController: ThemeController;
}
