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
 * @param httpContext - The request context.
 * @returns Its correlation ID.
 */
const publicContextOf = (httpContext: Context<AppEnv>): RequestContext => ({
  correlationId: correlationIdOf(httpContext),
});

/**
 * The request of a protected route.
 *
 * @param httpContext - The request context.
 * @returns Its correlation ID and signed-in actor.
 */
const signedInContextOf = (httpContext: Context<AppEnv>): SignedInContext => ({
  correlationId: correlationIdOf(httpContext), actor: actorOf(httpContext),
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
    .post('/auth/register', validate('json', registerBody), async (httpContext) => {
      const registration = httpContext.req.valid('json');
      const registered = await identity.register(publicContextOf(httpContext), registration);
      return httpContext.json(registered, 201);
    })
    .post('/auth/login', validate('json', zLoginBody), async (httpContext) => {
      const deviceInfo = httpContext.req.header('User-Agent') ?? null;
      const credentials = httpContext.req.valid('json');
      const tokens = await identity.login(publicContextOf(httpContext), credentials, deviceInfo);
      return httpContext.json(tokens);
    })
    .post('/auth/refresh', validate('json', zRefreshTokensBody), async (httpContext) => {
      const { refreshToken } = httpContext.req.valid('json');
      return httpContext.json(await identity.refresh(publicContextOf(httpContext), refreshToken));
    })
    .post('/auth/logout', signedIn, async (httpContext) => {
      await identity.logout(signedInContextOf(httpContext));
      return httpContext.body(null, 204);
    })
    .get('/users/me/sessions', signedIn, async (httpContext) => {
      const sessions = await identity.listSessions(signedInContextOf(httpContext));
      return httpContext.json({ data: sessions.map(toSessionJson) });
    })
    .delete('/users/me/sessions', signedIn, async (httpContext) => {
      await identity.revokeOtherSessions(signedInContextOf(httpContext));
      return httpContext.body(null, 204);
    })
    .delete('/users/me/sessions/:sessionId', signedIn, validSession, async (httpContext) => {
      const { sessionId } = httpContext.req.valid('param');
      await identity.revokeSession(signedInContextOf(httpContext), sessionId);
      return httpContext.body(null, 204);
    });
};

export default createIdentityRoutes;
