import type { DashboardReport, Notification, ReceivedInvitation } from '@financas/api-types';
import { REPORT } from '../monthFixtures';
import { OVERVIEW } from '../portfolioFixtures';

// What Review Insights' tests read (task 139): a Dashboard drawn from the
// overview's and the month's fixtures, an invitation waiting for Jane and the
// inbox's notifications — one invitation, one matured Holding, one already
// seen and one of a type this build doesn't know.

/** The Dashboard for September 2026. */
export const DASHBOARD: DashboardReport = {
  month: '2026-09',
  netWorth: OVERVIEW.netWorth,
  comingDue: OVERVIEW.comingDue,
  balances: REPORT.balances,
  budgets: REPORT.budgets,
  goals: REPORT.goals,
};

/** Alex's invitation to the Riveras, waiting for Jane. */
export const INVITATION: ReceivedInvitation = {
  id: 'inv-1',
  householdId: 'rivera',
  householdName: 'The Rivera Household',
  role: 'Member',
  invitedByUserId: 'alex',
  inviterFirstName: 'Alex',
  inviterLastName: 'Rivera',
  createdAt: '2026-10-13T10:00:00Z',
};

/** The invitation's notification, unseen. */
export const INVITED: Notification = {
  id: 'n-invite',
  type: 'invitation.received',
  params: { invitationId: 'inv-1', householdId: 'rivera', inviterUserId: 'alex' },
  seenAt: null,
  createdAt: '2026-10-13T10:00:00Z',
};

/** A matured CDB's notification, unseen. */
export const MATURED: Notification = {
  id: 'n-matured',
  type: 'holding.matured',
  params: {
    holdingId: 'cdb-1', assetType: 'cdb', ticker: 'CDB Banco Inter 2026', dueDate: '2026-09-30',
  },
  seenAt: null,
  createdAt: '2026-10-13T11:00:00Z',
};

/** A notification seen three days ago, of a type this build doesn't know. */
export const SEEN_OTHER = {
  id: 'n-other',
  type: 'invitation.accepted',
  params: {},
  seenAt: '2026-10-10T12:00:00Z',
  createdAt: '2026-10-10T12:00:00Z',
} as unknown as Notification;

/** The inbox, newest first. */
export const INBOX: readonly Notification[] = [MATURED, INVITED, SEEN_OTHER];

/**
 * Builds a notification with one field left out, as a malformed answer could be.
 *
 * @param notification - The notification.
 * @param field - The field to leave out.
 * @returns The notification without it.
 */
export const without = (notification: Notification, field: 'id' | 'createdAt'): Notification => (
  Object.fromEntries(Object.entries(notification).filter(([key]) => key !== field)) as Notification
);

/**
 * Builds a matured Holding's notification with other params.
 *
 * @param params - Its params.
 * @returns The notification.
 */
export const maturedWith = (params: Record<string, unknown>): Notification => (
  { ...MATURED, params }
);
