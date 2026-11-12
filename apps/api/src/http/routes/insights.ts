import {
  zDeleteNotificationPath, zExportAuditLogPath, zExportAuditLogQuery, zGetDashboardPath,
  zGetGoalProgressPath, zGetGoalProgressQuery, zGetHoldingPath, zGetReportPath,
  zGetReportQuery, zListGoalProgressPath, zListGoalProgressQuery, zListHouseholdHoldingsPath,
  zListHouseholdHoldingsQuery, zListHoldingsPath, zListHoldingsQuery, zMarkNotificationsSeenBody,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { InsightsManager } from '../../managers/insights';
import { requireSystemRole, type VerifyAccessToken } from '../authentication';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import {
  toDashboardJson, toGoalProgressJson, toGoalWithProgressJson, toInvestmentHoldingJson,
  toNotificationJson, toReportJson,
} from './insightsJson';
import { signedInContextOf } from './requestContext';

// InsightsManager's routes (OQ-201): the v1 reports — the Month Overview, the
// Investments overview and the payouts series (task 133, OQ-236) — Goal
// progress (current and by month) and the Holding reads with projections, one
// Account's or the whole household's (OQ-233); the Dashboard and the audit-log
// export (task 139, OQ-243). Those sit under `/households/:householdId`
// (OQ-174); the household role checks are InsightsManager's (OQ-111). The
// Notification Inbox is the user's own, under `/notifications`, behind its own
// signed-in guard — the household guard doesn't reach it.

const HOUSEHOLD = '/households/:householdId';

/**
 * Builds the Insights routes.
 *
 * @param insights - The Manager.
 * @param verifyAccessToken - Token verification, for the inbox's guard.
 * @returns The routes, relative to `/api/v1`.
 */
const createInsightsRoutes = (
  insights: InsightsManager,
  verifyAccessToken: VerifyAccessToken,
) => new Hono<AppEnv>()
  .use('/notifications', requireSystemRole(verifyAccessToken, 'USER'))
  .use('/notifications/*', requireSystemRole(verifyAccessToken, 'USER'))
  .get(
    `${HOUSEHOLD}/reports/:reportType`,
    validate('param', zGetReportPath),
    validate('query', zGetReportQuery),
    async (httpContext) => {
      const { householdId, reportType } = httpContext.req.valid('param');
      const asked = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const report = await insights.report(context, householdId, reportType, asked);
      return httpContext.json(toReportJson(report));
    },
  )
  .get(
    `${HOUSEHOLD}/goal-progress`,
    validate('param', zListGoalProgressPath),
    validate('query', zListGoalProgressQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const { status } = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const progress = await insights.goalProgressList(context, householdId, status);
      return httpContext.json({ data: progress.map(toGoalWithProgressJson) });
    },
  )
  .get(
    `${HOUSEHOLD}/goals/:goalId/progress`,
    validate('param', zGetGoalProgressPath),
    validate('query', zGetGoalProgressQuery),
    async (httpContext) => {
      const { householdId, goalId } = httpContext.req.valid('param');
      const { year, month } = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const asked = { year, month };
      const progress = await insights.goalProgressFor(context, householdId, goalId, asked);
      return httpContext.json(toGoalProgressJson(progress));
    },
  )
  .get(
    `${HOUSEHOLD}/accounts/:accountId/holdings`,
    validate('param', zListHoldingsPath),
    validate('query', zListHoldingsQuery),
    async (httpContext) => {
      const { householdId, accountId } = httpContext.req.valid('param');
      const { includeArchived } = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const holdings = await insights.listHoldings(
        context,
        householdId,
        accountId,
        includeArchived,
      );
      return httpContext.json({ data: holdings.map(toInvestmentHoldingJson) });
    },
  )
  .get(
    `${HOUSEHOLD}/holdings`,
    validate('param', zListHouseholdHoldingsPath),
    validate('query', zListHouseholdHoldingsQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const { includeArchived } = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const holdings = await insights.listHouseholdHoldings(context, householdId, includeArchived);
      return httpContext.json({ data: holdings.map(toInvestmentHoldingJson) });
    },
  )
  .get(
    `${HOUSEHOLD}/holdings/:holdingId`,
    validate('param', zGetHoldingPath),
    async (httpContext) => {
      const { householdId, holdingId } = httpContext.req.valid('param');
      const context = signedInContextOf(httpContext);
      const holding = await insights.getHolding(context, householdId, holdingId);
      return httpContext.json(toInvestmentHoldingJson(holding));
    },
  )
  .get(
    `${HOUSEHOLD}/dashboard`,
    validate('param', zGetDashboardPath),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const panels = await insights.getDashboard(signedInContextOf(httpContext), householdId);
      return httpContext.json(toDashboardJson(panels));
    },
  )
  .get(
    `${HOUSEHOLD}/audit-log/export`,
    validate('param', zExportAuditLogPath),
    validate('query', zExportAuditLogQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const range = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const { csv, filename } = await insights.exportAuditLog(context, householdId, range);
      return httpContext.body(csv, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
    },
  )
  .get('/notifications', async (httpContext) => {
    const notifications = await insights.listNotifications(signedInContextOf(httpContext));
    return httpContext.json({ data: notifications.map(toNotificationJson) });
  })
  .post(
    '/notifications/seen',
    validate('json', zMarkNotificationsSeenBody),
    async (httpContext) => {
      const { notificationIds } = httpContext.req.valid('json');
      await insights.markNotificationsSeen(signedInContextOf(httpContext), notificationIds);
      return httpContext.body(null, 204);
    },
  )
  .delete(
    '/notifications/:notificationId',
    validate('param', zDeleteNotificationPath),
    async (httpContext) => {
      const { notificationId } = httpContext.req.valid('param');
      await insights.deleteNotification(signedInContextOf(httpContext), notificationId);
      return httpContext.body(null, 204);
    },
  );

export default createInsightsRoutes;
