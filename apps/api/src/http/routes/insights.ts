import {
  zGetGoalProgressPath, zGetGoalProgressQuery, zGetHoldingPath, zGetReportPath,
  zGetReportQuery, zListGoalProgressPath, zListGoalProgressQuery, zListHoldingsPath,
  zListHoldingsQuery,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { InsightsManager } from '../../managers/insights';
import { createDomainError } from '../../utilities/domainError';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import {
  toGoalProgressJson, toGoalWithProgressJson, toInvestmentHoldingJson,
} from './insightsJson';
import { signedInContextOf } from './requestContext';

// InsightsManager's slice-3 routes (OQ-201): the Month Overview report, Goal
// progress (current and by month) and the Holding reads with projections. The
// other `/reports` types land beside their first caller (task 133); until then
// they answer 400 `report.unknown_type_or_range`, the code the contract already
// reserves for this endpoint. Every path sits under `/households/:householdId`
// (OQ-174); the household role checks are InsightsManager's (OQ-111).

const HOUSEHOLD = '/households/:householdId';

/** The v1 report types this build does not serve yet — task 133. */
const NOT_SERVED_YET = new Set(['investments-overview', 'payouts']);

/**
 * Refuses a v1 report type this build has not implemented (task 133).
 *
 * @returns `report.unknown_type_or_range`, the code the contract reserves here.
 */
const reportNotServed = () => createDomainError({
  code: 'report.unknown_type_or_range', message: 'Report type not served yet',
});

/**
 * Builds the Insights routes.
 *
 * @param insights - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createInsightsRoutes = (insights: InsightsManager) => new Hono<AppEnv>()
  .get(
    `${HOUSEHOLD}/reports/:reportType`,
    validate('param', zGetReportPath),
    validate('query', zGetReportQuery),
    async (httpContext) => {
      const { householdId, reportType } = httpContext.req.valid('param');
      if (NOT_SERVED_YET.has(reportType)) throw reportNotServed();
      const { year, month } = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const overview = await insights.monthOverview(context, householdId, { year, month });
      return httpContext.json({
        reportType: 'month-overview',
        ...overview,
        goals: overview.goals.map(toGoalWithProgressJson),
      });
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
    `${HOUSEHOLD}/holdings/:holdingId`,
    validate('param', zGetHoldingPath),
    async (httpContext) => {
      const { householdId, holdingId } = httpContext.req.valid('param');
      const context = signedInContextOf(httpContext);
      const holding = await insights.getHolding(context, householdId, holdingId);
      return httpContext.json(toInvestmentHoldingJson(holding));
    },
  );

export default createInsightsRoutes;
