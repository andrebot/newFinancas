import {
  zLoginBody, zRefreshTokensBody, zRegisterUserBody,
} from '@financas/api-types/zod';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type {
  IdentityManager, RequestContext, SessionView, SignedInContext,
} from '../../managers/identity';
import { actorOf, requireSystemRole, type VerifyAccessToken } from '../authentication';
import { correlationIdOf, type AppEnv } from '../errorHandler';
import { validate } from '../validation';

// IdentityManager's routes (M1): thin — validate against the contract, call the
// use case, shape the response. Register, login and refresh are public; the rest
// need a signed-in USER (OQ-111).

// The minimum length is IdentityManager's rule, answered as `password.too_short`
// (BDT plan), not as a generic validation failure.
const registerBody = zRegisterUserBody.extend({ password: z.string() });
const validSession = validate('param', z.object({ sessionId: z.uuid() }));

/**
 * The request of a public route (no one is signed in yet).
 *
 * @param c - The request context.
 * @returns Its correlation ID.
 */
const publicContextOf = (c: Context<AppEnv>): RequestContext => ({
  correlationId: correlationIdOf(c),
});

/**
 * The request of a protected route.
 *
 * @param c - The request context.
 * @returns Its correlation ID and signed-in actor.
 */
const signedInContextOf = (c: Context<AppEnv>): SignedInContext => ({
  correlationId: correlationIdOf(c), actor: actorOf(c),
});

/**
 * A session as the contract shows it (`components/schemas/Session`).
 *
 * @param session - The use case's view.
 * @returns The JSON shape, times as ISO strings.
 */
export const toSessionJson = (session: SessionView) => ({
  id: session.id,
  deviceInfo: session.deviceInfo,
  createdAt: session.createdAt.toISOString(),
  lastUsedAt: session.lastUsedAt.toISOString(),
  current: session.current,
});

/**
 * Builds IdentityManager's routes.
 *
 * @param identity - The Manager.
 * @param verifyAccessToken - For the protected routes.
 * @returns The routes, relative to `/api/v1`.
 */
const createIdentityRoutes = (identity: IdentityManager, verifyAccessToken: VerifyAccessToken) => {
  const signedIn = requireSystemRole(verifyAccessToken, 'USER');
  return new Hono<AppEnv>()
    .post('/auth/register', validate('json', registerBody), async (c) => (
      c.json(await identity.register(publicContextOf(c), c.req.valid('json')), 201)
    ))
    .post('/auth/login', validate('json', zLoginBody), async (c) => {
      const deviceInfo = c.req.header('User-Agent') ?? null;
      return c.json(await identity.login(publicContextOf(c), c.req.valid('json'), deviceInfo));
    })
    .post('/auth/refresh', validate('json', zRefreshTokensBody), async (c) => (
      c.json(await identity.refresh(publicContextOf(c), c.req.valid('json').refreshToken))
    ))
    .post('/auth/logout', signedIn, async (c) => {
      await identity.logout(signedInContextOf(c));
      return c.body(null, 204);
    })
    .get('/users/me/sessions', signedIn, async (c) => {
      const sessions = await identity.listSessions(signedInContextOf(c));
      return c.json({ data: sessions.map(toSessionJson) });
    })
    .delete('/users/me/sessions', signedIn, async (c) => {
      await identity.revokeOtherSessions(signedInContextOf(c));
      return c.body(null, 204);
    })
    .delete('/users/me/sessions/:sessionId', signedIn, validSession, async (c) => {
      await identity.revokeSession(signedInContextOf(c), c.req.valid('param').sessionId);
      return c.body(null, 204);
    });
};

export default createIdentityRoutes;
