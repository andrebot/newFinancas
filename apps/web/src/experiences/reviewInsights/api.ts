import type {
  DashboardReport, GetDashboardResponse, ListNotificationsResponse, Notification,
} from '@financas/api-types';
import { changedTags } from '../../api/backendApi';
import { investmentsApi } from '../../api/investmentsApi';
import send from '../../api/send';

// The Review Insights Experience's own endpoints (X8; OQ-242, OQ-243): the
// Dashboard, the user's Notification Inbox and the audit-log export. The
// Dashboard is built on the household's accounts, Budgets, Goals and Holdings,
// so it provides their tags too and any write to them refreshes it (PR #145);
// a market value write refreshes it through the Goals it funds. The inbox is
// one cache: marking seen and deleting refresh it, a delete whose
// notification is already gone too. The export is fetched on demand and never
// cached — a CSV, not JSON, read by the response's own type so an error still
// comes back as the envelope.

/** The audit-log export's question: the household and both days, included. */
export interface AuditExportInput {
  readonly householdId: string;
  /** `YYYY-MM-DD`. */
  readonly startDate: string;
  /** `YYYY-MM-DD`. */
  readonly endDate: string;
}

/** The export as it downloads: the CSV and the name the API gave it. */
export interface AuditExportFile {
  readonly csv: string;
  readonly filename: string;
}

/** Builds a household's path. */
const householdPath = (householdId: string) => `/households/${encodeURIComponent(householdId)}`;

/**
 * Builds the export's address.
 *
 * @param input - The household and the days.
 * @returns The path and search.
 */
export const auditExportPathOf = ({ householdId, startDate, endDate }: AuditExportInput) => (
  `${householdPath(householdId)}/audit-log/export?${new URLSearchParams({
    startDate, endDate,
  }).toString()}`
);

/**
 * Reads the file name a `Content-Disposition: attachment` header gives.
 *
 * @param header - The header, if the response had one.
 * @param fallback - The name to use when it gives none.
 * @returns The file name.
 */
export const attachmentNameOf = (header: string | null | undefined, fallback: string): string => (
  /filename="([^"]+)"/.exec(header ?? '')?.[1] ?? fallback
);

/** What a notification write makes stale. */
const INBOX_TAGS = ['Notifications'] as const;

/** Review Insights' slice of the backend API. */
export const reviewInsightsApi = investmentsApi.enhanceEndpoints({
  addTagTypes: ['Dashboard', 'Notifications'],
}).injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<DashboardReport, string>({
      query: (householdId) => `${householdPath(householdId)}/dashboard`,
      transformResponse: (response: GetDashboardResponse) => response,
      providesTags: ['Dashboard', 'Accounts', 'Budgets', 'Goals', 'Holdings'],
    }),
    listNotifications: build.query<readonly Notification[], void>({
      query: () => '/notifications',
      transformResponse: (response: ListNotificationsResponse) => response.data ?? [],
      providesTags: ['Notifications'],
    }),
    markNotificationsSeen: build.mutation<void, readonly string[]>({
      query: (notificationIds) => send('POST', '/notifications/seen', { notificationIds }),
      invalidatesTags: (_result, error) => changedTags(INBOX_TAGS, error),
    }),
    deleteNotification: build.mutation<void, string>({
      query: (notificationId) => (
        send('DELETE', `/notifications/${encodeURIComponent(notificationId)}`)
      ),
      invalidatesTags: (_result, error) => changedTags(INBOX_TAGS, error, 'notification.not_found'),
    }),
    exportAuditLog: build.mutation<AuditExportFile, AuditExportInput>({
      query: (input) => ({ url: auditExportPathOf(input), responseHandler: 'content-type' }),
      transformResponse: (csv: string, meta, input) => ({
        csv,
        filename: attachmentNameOf(
          meta?.response?.headers.get('Content-Disposition'),
          `audit-log-${input.startDate}-${input.endDate}.csv`,
        ),
      }),
    }),
  }),
});

export const {
  useGetDashboardQuery,
  useListNotificationsQuery,
  useMarkNotificationsSeenMutation,
  useDeleteNotificationMutation,
  useExportAuditLogMutation,
} = reviewInsightsApi;
