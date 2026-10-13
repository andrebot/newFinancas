import {
  zChangePasswordBody, zConfirmPasswordResetBody, zLoginBody, zRecoverWithMfaCodeBody,
  zEditCurrentUserBody, zRefreshTokensBody, zRegisterUserBody, zRequestPasswordResetBody,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import { z } from 'zod';
import type { IdentityManager } from '../../managers/identity';
import { requireSystemRole, type VerifyAccessToken } from '../authentication';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import {
  toReceivedInvitationJson, toSessionJson, toUserJson,
} from './identityJson';
import { publicContextOf, signedInContextOf } from './requestContext';

// IdentityManager's routes (M1): thin — validate against the contract, call the
// use case, shape the response. Register, login and refresh are public; the rest
// need a signed-in USER (OQ-111).

// The minimum length is IdentityManager's rule, answered as `password.too_short`
// (BDT plan), not as a generic validation failure.
// Names are trimmed and must not be blank (OQ-116); the contract's minLength
// alone would accept "  ".
const name = z.string().trim().min(1);
const registerBody = zRegisterUserBody.extend({
  password: z.string(), firstName: name, lastName: name,
});
const validProfileEdit = validate(
  'json',
  zEditCurrentUserBody.extend({ firstName: name.optional(), lastName: name.optional() }),
);
const validPasswordChange = validate(
  'json',
  zChangePasswordBody.extend({ newPassword: z.string() }),
);
const validResetConfirmation = validate(
  'json',
  zConfirmPasswordResetBody.extend({ newPassword: z.string() }),
);
const validResetRequest = validate('json', zRequestPasswordResetBody);
const validSession = validate('param', z.object({ sessionId: z.uuid() }));

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
    .post('/auth/mfa/recover', validate('json', zRecoverWithMfaCodeBody), async (httpContext) => {
      const deviceInfo = httpContext.req.header('User-Agent') ?? null;
      const credentials = httpContext.req.valid('json');
      const context = publicContextOf(httpContext);
      return httpContext.json(await identity.recoverWithCode(context, credentials, deviceInfo));
    })
    .post('/auth/password-reset/request', validResetRequest, async (httpContext) => {
      const { email } = httpContext.req.valid('json');
      await identity.requestPasswordReset(publicContextOf(httpContext), email);
      return httpContext.body(null, 202);
    })
    .post('/auth/password-reset/confirm', validResetConfirmation, async (httpContext) => {
      const confirmation = httpContext.req.valid('json');
      await identity.confirmPasswordReset(publicContextOf(httpContext), confirmation);
      return httpContext.body(null, 200);
    })
    .post('/auth/change-password', signedIn, validPasswordChange, async (httpContext) => {
      const change = httpContext.req.valid('json');
      await identity.changePassword(signedInContextOf(httpContext), change);
      return httpContext.body(null, 200);
    })
    .post('/auth/refresh', validate('json', zRefreshTokensBody), async (httpContext) => {
      const { refreshToken } = httpContext.req.valid('json');
      return httpContext.json(await identity.refresh(publicContextOf(httpContext), refreshToken));
    })
    .post('/auth/logout', signedIn, async (httpContext) => {
      await identity.logout(signedInContextOf(httpContext));
      return httpContext.body(null, 204);
    })
    .get('/users/me', signedIn, async (httpContext) => (
      httpContext.json(toUserJson(await identity.getProfile(signedInContextOf(httpContext))))
    ))
    .patch('/users/me', signedIn, validProfileEdit, async (httpContext) => {
      const edit = httpContext.req.valid('json');
      const user = await identity.editProfile(signedInContextOf(httpContext), edit);
      return httpContext.json(toUserJson(user));
    })
    .get('/users/me/invitations', signedIn, async (httpContext) => {
      const invitations = await identity.listMyInvitations(signedInContextOf(httpContext));
      return httpContext.json({ data: invitations.map(toReceivedInvitationJson) });
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
