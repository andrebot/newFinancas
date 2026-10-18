import {
  zArchiveHoldingPath, zDeleteMarketValuePath, zEditHoldingBody, zEditHoldingPath,
  zEditMarketValueBody, zEditMarketValuePath, zListHoldingAllocationsPath,
  zListScheduleEntriesPath, zListValuationSnapshotsPath, zListValuationSnapshotsQuery,
  zRecordMarketValueBody, zRecordMarketValuePath,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import type { AccountManager } from '../../managers/account';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import { toScheduleEntryJson, toValuationSnapshotJson } from './accountJson';
import { signedInContextOf } from './requestContext';

// Investment administration on a Holding (M2 part 5, OQ-174 ⑤): its Goal split,
// its archive from the matured notice, its schedule and its manual market
// values. Reading Holdings themselves (with projections) is InsightsManager's.
// Every path sits under `/households/:householdId` (OQ-174); the household role
// checks are AccountManager's (OQ-111).

const HOLDING_PATH = '/households/:householdId/holdings/:holdingId';
const SNAPSHOTS_PATH = `${HOLDING_PATH}/valuation-snapshots`;
const SNAPSHOT_PATH = `${SNAPSHOTS_PATH}/:snapshotId`;

/**
 * Builds the Holding routes.
 *
 * @param account - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createHoldingRoutes = (account: AccountManager) => new Hono<AppEnv>()
  .patch(
    HOLDING_PATH,
    validate('param', zEditHoldingPath),
    validate('json', zEditHoldingBody),
    async (httpContext) => {
      const { householdId, holdingId } = httpContext.req.valid('param');
      const { allocations } = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const split = await account.editHolding(context, householdId, holdingId, allocations);
      return httpContext.json({ data: split });
    },
  )
  .get(
    `${HOLDING_PATH}/allocations`,
    validate('param', zListHoldingAllocationsPath),
    async (httpContext) => {
      const { householdId, holdingId } = httpContext.req.valid('param');
      const context = signedInContextOf(httpContext);
      const split = await account.listHoldingAllocations(context, householdId, holdingId);
      return httpContext.json({ data: split });
    },
  )
  .post(`${HOLDING_PATH}/archive`, validate('param', zArchiveHoldingPath), async (httpContext) => {
    const { householdId, holdingId } = httpContext.req.valid('param');
    await account.archiveHolding(signedInContextOf(httpContext), householdId, holdingId);
    return httpContext.body(null, 204);
  })
  .get(
    `${HOLDING_PATH}/schedule-entries`,
    validate('param', zListScheduleEntriesPath),
    async (httpContext) => {
      const { householdId, holdingId } = httpContext.req.valid('param');
      const context = signedInContextOf(httpContext);
      const entries = await account.listScheduleEntries(context, householdId, holdingId);
      return httpContext.json({ data: entries.map(toScheduleEntryJson) });
    },
  )
  .get(
    SNAPSHOTS_PATH,
    validate('param', zListValuationSnapshotsPath),
    validate('query', zListValuationSnapshotsQuery),
    async (httpContext) => {
      const { householdId, holdingId } = httpContext.req.valid('param');
      const { startDate, endDate } = httpContext.req.valid('query');
      const context = signedInContextOf(httpContext);
      const snapshots = await account.listValuationSnapshots(context, householdId, holdingId, {
        ...(startDate === undefined ? {} : { from: startDate }),
        ...(endDate === undefined ? {} : { to: endDate }),
      });
      return httpContext.json({ data: snapshots.map(toValuationSnapshotJson) });
    },
  )
  .post(
    SNAPSHOTS_PATH,
    validate('param', zRecordMarketValuePath),
    validate('json', zRecordMarketValueBody),
    async (httpContext) => {
      const { householdId, holdingId } = httpContext.req.valid('param');
      const input = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const snapshot = await account.recordMarketValue(context, householdId, holdingId, input);
      return httpContext.json(toValuationSnapshotJson(snapshot), 201);
    },
  )
  .patch(
    SNAPSHOT_PATH,
    validate('param', zEditMarketValuePath),
    validate('json', zEditMarketValueBody),
    async (httpContext) => {
      const { householdId, holdingId, snapshotId } = httpContext.req.valid('param');
      const edit = httpContext.req.valid('json');
      const context = signedInContextOf(httpContext);
      const snapshot = await account.editMarketValue(
        context,
        householdId,
        holdingId,
        snapshotId,
        edit,
      );
      return httpContext.json(toValuationSnapshotJson(snapshot));
    },
  )
  .delete(SNAPSHOT_PATH, validate('param', zDeleteMarketValuePath), async (httpContext) => {
    const { householdId, holdingId, snapshotId } = httpContext.req.valid('param');
    const context = signedInContextOf(httpContext);
    await account.deleteMarketValue(context, householdId, holdingId, snapshotId);
    return httpContext.body(null, 204);
  });

export default createHoldingRoutes;
