import {
  zCreateBudgetBody, zCreateBudgetPath, zDeleteBudgetPath, zEditBudgetBody, zEditBudgetPath,
  zGetBudgetPath, zListBudgetPeriodsPath, zListBudgetPeriodsQuery, zListBudgetsPath,
  zListBudgetsQuery,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { AccountManager } from '../../managers/account';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import { toBudgetJson, toBudgetPeriodJson } from './accountJson';
import { monthRangeOf } from './accounts';
import { signedInContextOf } from './requestContext';

// A household's Budgets and their monthly periods (M2, FR-4). Every path sits
// under `/households/:householdId` (OQ-174), so the `/households/*` guard admits
// only signed-in USERs; the household role checks are AccountManager's (OQ-111).

const BUDGETS_PATH = '/households/:householdId/budgets';
const BUDGET_PATH = `${BUDGETS_PATH}/:budgetId`;

/**
 * Builds the Budget routes.
 *
 * @param account - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createBudgetRoutes = (account: AccountManager) => new Hono<AppEnv>()
  .get(
    BUDGETS_PATH,
    validate('param', zListBudgetsPath),
    validate('query', zListBudgetsQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const filter = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const budgets = await account.listBudgets(context, householdId, filter);
      return httpContext.json({ data: budgets.map(toBudgetJson) });
    },
  )
  .post(
    BUDGETS_PATH,
    validate('param', zCreateBudgetPath),
    validate('json', zCreateBudgetBody),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const request = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const created = await account.createBudget(context, householdId, request);
      return httpContext.json(toBudgetJson(created), 201);
    },
  )
  .get(BUDGET_PATH, validate('param', zGetBudgetPath), async (httpContext) => {
    const { householdId, budgetId } = httpContext.req.valid('param');
    const context = signedInContextOf(httpContext);
    return httpContext.json(toBudgetJson(await account.getBudget(context, householdId, budgetId)));
  })
  .patch(
    BUDGET_PATH,
    validate('param', zEditBudgetPath),
    validate('json', zEditBudgetBody),
    async (httpContext) => {
      const { householdId, budgetId } = httpContext.req.valid('param');
      const edit = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const edited = await account.editBudget(context, householdId, budgetId, edit);
      return httpContext.json(toBudgetJson(edited));
    },
  )
  .delete(BUDGET_PATH, validate('param', zDeleteBudgetPath), async (httpContext) => {
    const { householdId, budgetId } = httpContext.req.valid('param');
    await account.deleteBudget(signedInContextOf(httpContext), householdId, budgetId);
    return httpContext.body(null, 204);
  })
  .get(
    `${BUDGET_PATH}/periods`,
    validate('param', zListBudgetPeriodsPath),
    validate('query', zListBudgetPeriodsQuery),
    async (httpContext) => {
      const { householdId, budgetId } = httpContext.req.valid('param');
      const range = monthRangeOf(httpContext.req.valid('query'));
      const context = signedInContextOf(httpContext);
      const periods = await account.listBudgetPeriods(context, householdId, budgetId, range);
      return httpContext.json({ data: periods.map(toBudgetPeriodJson) });
    },
  );

export default createBudgetRoutes;
