import type { APIRequestContext } from '@playwright/test';
import type { DashboardReport, Notification } from '@financas/api-types';
import { API_URL, send, type TestUser } from './identityApi';

// Reading what Review Insights works on through the API (I11): the
// Dashboard, the signed-in user's notifications and the household's audit-log
// export — the end state an insights journey checks, and the export's
// refusal, which the browser never offers a Viewer.

/** Who acts: a member's access token. */
type Member = Pick<TestUser, 'accessToken'>;

/**
 * Reads the household's Dashboard, as the Dashboard page does.
 *
 * @param request - Playwright's API client.
 * @param member - A member of the household.
 * @param householdId - The household.
 * @returns The report: the month, net worth, Coming Due and the month's rails.
 */
export const dashboard = (
  request: APIRequestContext,
  member: Member,
  householdId: string,
): Promise<DashboardReport> => send<DashboardReport>(
  request,
  'GET',
  `/households/${householdId}/dashboard`,
  { accessToken: member.accessToken },
);

/**
 * Lists the signed-in user's notifications, as the bell polls them.
 *
 * @param request - Playwright's API client.
 * @param user - The recipient.
 * @returns Their notifications, newest first.
 */
export const notifications = async (
  request: APIRequestContext,
  user: Member,
): Promise<readonly Notification[]> => {
  const list = await send<{ data?: Notification[] }>(request, 'GET', '/notifications', {
    accessToken: user.accessToken,
  });
  return list.data ?? [];
};

/** An audit-log export's answer, refused or not. */
export interface ExportAnswer {
  readonly status: number;
  /** The CSV when it succeeded, the error body's text otherwise. */
  readonly body: string;
}

/**
 * Asks for the household's audit log over a range, without failing the test on
 * a refusal — the Viewer's 403 is what core #12 checks.
 *
 * @param request - Playwright's API client.
 * @param member - Who asks.
 * @param householdId - The household.
 * @param range - The first and last day included, `YYYY-MM-DD`.
 * @returns The status and the body.
 */
export const exportAuditLog = async (
  request: APIRequestContext,
  member: Member,
  householdId: string,
  range: { readonly startDate: string; readonly endDate: string },
): Promise<ExportAnswer> => {
  const query = new URLSearchParams(range).toString();
  const response = await request.get(
    `${API_URL}/households/${householdId}/audit-log/export?${query}`,
    { headers: { Authorization: `Bearer ${member.accessToken}` } },
  );
  return { status: response.status(), body: await response.text() };
};
