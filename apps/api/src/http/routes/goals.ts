import {
  zCompleteGoalPath, zCreateGoalBody, zCreateGoalPath, zDeleteGoalPath, zEditGoalBody,
  zEditGoalPath, zGetGoalPath, zListGoalsPath, zListGoalsQuery, zReopenGoalPath,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { AccountManager } from '../../managers/account';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import { toGoalJson } from './accountJson';
import { signedInContextOf } from './requestContext';

// A household's Goals — their definitions (M2, FR-8). Progress is
// InsightsManager's, on its own route (OQ-177). Every path sits under
// `/households/:householdId` (OQ-174), so the `/households/*` guard admits only
// signed-in USERs; the household role checks are AccountManager's (OQ-111).

const GOALS_PATH = '/households/:householdId/goals';
const GOAL_PATH = `${GOALS_PATH}/:goalId`;

/**
 * Builds the Goal routes.
 *
 * @param account - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createGoalRoutes = (account: AccountManager) => new Hono<AppEnv>()
  .get(
    GOALS_PATH,
    validate('param', zListGoalsPath),
    validate('query', zListGoalsQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const { status } = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const goals = await account.listGoals(context, householdId, status);
      return httpContext.json({ data: goals.map(toGoalJson) });
    },
  )
  .post(
    GOALS_PATH,
    validate('param', zCreateGoalPath),
    validate('json', zCreateGoalBody),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const request = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const created = await account.createGoal(context, householdId, request);
      return httpContext.json(toGoalJson(created), 201);
    },
  )
  .get(GOAL_PATH, validate('param', zGetGoalPath), async (httpContext) => {
    const { householdId, goalId } = httpContext.req.valid('param');
    const context = signedInContextOf(httpContext);
    return httpContext.json(toGoalJson(await account.getGoal(context, householdId, goalId)));
  })
  .patch(
    GOAL_PATH,
    validate('param', zEditGoalPath),
    validate('json', zEditGoalBody),
    async (httpContext) => {
      const { householdId, goalId } = httpContext.req.valid('param');
      const edit = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const edited = await account.editGoal(context, householdId, goalId, edit);
      return httpContext.json(toGoalJson(edited));
    },
  )
  .delete(GOAL_PATH, validate('param', zDeleteGoalPath), async (httpContext) => {
    const { householdId, goalId } = httpContext.req.valid('param');
    await account.deleteGoal(signedInContextOf(httpContext), householdId, goalId);
    return httpContext.body(null, 204);
  })
  .post(`${GOAL_PATH}/complete`, validate('param', zCompleteGoalPath), async (httpContext) => {
    const { householdId, goalId } = httpContext.req.valid('param');
    await account.completeGoal(signedInContextOf(httpContext), householdId, goalId);
    return httpContext.body(null, 204);
  })
  .post(`${GOAL_PATH}/reopen`, validate('param', zReopenGoalPath), async (httpContext) => {
    const { householdId, goalId } = httpContext.req.valid('param');
    await account.reopenGoal(signedInContextOf(httpContext), householdId, goalId);
    return httpContext.body(null, 204);
  });

export default createGoalRoutes;
