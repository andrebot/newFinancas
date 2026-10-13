import {
  zChangeMemberRoleBody, zCreateHouseholdBody, zTransferOwnershipBody,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import { z } from 'zod';
import type { IdentityManager } from '../../managers/identity';
import { requireSystemRole, type VerifyAccessToken } from '../authentication';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import { toMembershipJson, toMyHouseholdJson } from './identityJson';
import { signedInContextOf } from './requestContext';

// Households and their members (M1): every route needs a signed-in USER; the
// household role checks are IdentityManager's (OQ-111, OQ-117).

const validHousehold = validate('param', z.object({ householdId: z.uuid() }));
const validMember = validate('param', z.object({ householdId: z.uuid(), userId: z.uuid() }));
// The name is trimmed and must not be blank (OQ-116).
const validNewHousehold = validate(
  'json',
  zCreateHouseholdBody.extend({ name: z.string().trim().min(1) }),
);
const validRole = validate('json', zChangeMemberRoleBody);
const validTransfer = validate('json', zTransferOwnershipBody);
const ROLE_PATH = '/households/:householdId/members/:userId/role';
const TRANSFER_PATH = '/households/:householdId/transfer-ownership';

/**
 * Builds the household and member routes.
 *
 * @param identity - The Manager.
 * @param verifyAccessToken - Access-token verification.
 * @returns The routes, relative to `/api/v1`.
 */
const createHouseholdRoutes = (
  identity: IdentityManager,
  verifyAccessToken: VerifyAccessToken,
) => new Hono<AppEnv>()
  // `/households/*` also matches `/households` itself, so one guard covers every route.
  .use('/households/*', requireSystemRole(verifyAccessToken, 'USER'))
  .get('/households', async (httpContext) => {
    const households = await identity.listMyHouseholds(signedInContextOf(httpContext));
    return httpContext.json({ data: households.map(toMyHouseholdJson) });
  })
  .post('/households', validNewHousehold, async (httpContext) => {
    const { name } = httpContext.req.valid('json');
    const household = await identity.createHousehold(signedInContextOf(httpContext), name);
    return httpContext.json(toMyHouseholdJson(household), 201);
  })
  .get('/households/:householdId', validHousehold, async (httpContext) => {
    const { householdId } = httpContext.req.valid('param');
    const household = await identity.getHousehold(signedInContextOf(httpContext), householdId);
    return httpContext.json(toMyHouseholdJson(household));
  })
  .delete('/households/:householdId', validHousehold, async (httpContext) => {
    const { householdId } = httpContext.req.valid('param');
    await identity.deleteHousehold(signedInContextOf(httpContext), householdId);
    return httpContext.body(null, 204);
  })
  .get('/households/:householdId/members', validHousehold, async (httpContext) => {
    const { householdId } = httpContext.req.valid('param');
    const members = await identity.listMembers(signedInContextOf(httpContext), householdId);
    return httpContext.json({
      data: members.map((member) => toMembershipJson(householdId, member)),
    });
  })
  .delete('/households/:householdId/members/:userId', validMember, async (httpContext) => {
    const { householdId, userId } = httpContext.req.valid('param');
    await identity.removeMember(signedInContextOf(httpContext), householdId, userId);
    return httpContext.body(null, 204);
  })
  .patch(ROLE_PATH, validMember, validRole, async (httpContext) => {
    const { householdId, userId } = httpContext.req.valid('param');
    const { role } = httpContext.req.valid('json');
    await identity.changeMemberRole(signedInContextOf(httpContext), householdId, userId, role);
    return httpContext.body(null, 200);
  })
  .post(TRANSFER_PATH, validHousehold, validTransfer, async (httpContext) => {
    const { householdId } = httpContext.req.valid('param');
    const { targetUserId } = httpContext.req.valid('json');
    await identity.transferOwnership(signedInContextOf(httpContext), householdId, targetUserId);
    return httpContext.body(null, 200);
  });

export default createHouseholdRoutes;
