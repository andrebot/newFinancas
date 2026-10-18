import {
  zDeleteIndexRatePath, zEditIndexRateBody, zEditIndexRatePath, zListIndexRatesPath,
  zRecordIndexRateBody, zRecordIndexRatePath,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { AccountManager } from '../../managers/account';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import { toIndexRateJson, toIndexRateSeriesJson } from './accountJson';
import { signedInContextOf } from './requestContext';

// A household's Index Reference Rates (M2 part 5, FR-11.6): the Rates tab's
// history and its manual values. Every path sits under
// `/households/:householdId` (OQ-174); the household role checks are
// AccountManager's (OQ-111).

const RATES_PATH = '/households/:householdId/index-rates';
const VALUES_PATH = `${RATES_PATH}/:index/values`;
const VALUE_PATH = `${VALUES_PATH}/:valueId`;

/**
 * Builds the index rate routes.
 *
 * @param account - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createIndexRateRoutes = (account: AccountManager) => new Hono<AppEnv>()
  .get(RATES_PATH, validate('param', zListIndexRatesPath), async (httpContext) => {
    const { householdId } = httpContext.req.valid('param');
    const series = await account.listIndexRates(signedInContextOf(httpContext), householdId);
    return httpContext.json({ data: series.map(toIndexRateSeriesJson) });
  })
  .post(
    VALUES_PATH,
    validate('param', zRecordIndexRatePath),
    validate('json', zRecordIndexRateBody),
    async (httpContext) => {
      const { householdId, index } = httpContext.req.valid('param');
      const input = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const rate = await account.recordIndexRate(context, householdId, index, input);
      return httpContext.json(toIndexRateJson(rate), 201);
    },
  )
  .patch(
    VALUE_PATH,
    validate('param', zEditIndexRatePath),
    validate('json', zEditIndexRateBody),
    async (httpContext) => {
      const { householdId, index, valueId } = httpContext.req.valid('param');
      const edit = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const rate = await account.editIndexRate(context, householdId, index, valueId, edit);
      return httpContext.json(toIndexRateJson(rate));
    },
  )
  .delete(VALUE_PATH, validate('param', zDeleteIndexRatePath), async (httpContext) => {
    const { householdId, index, valueId } = httpContext.req.valid('param');
    await account.deleteIndexRate(signedInContextOf(httpContext), householdId, index, valueId);
    return httpContext.body(null, 204);
  });

export default createIndexRateRoutes;
