import { Hono } from 'hono';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  actorOf, bearerToken, requireSystemRole,
} from '../../../src/http/authentication';
import { createErrorHandler, type AppEnv } from '../../../src/http/errorHandler';
import { errorOf } from '../../support/app';

const ACTOR = { userId: 'u1', sessionId: 's1', systemRole: 'USER' as const };

describe('bearerToken', () => {
  it.each([
    ['Bearer abc.def', 'abc.def'],
    ['bearer abc', undefined],
    ['Bearer ', undefined],
    ['Bearer a b', undefined],
    [undefined, undefined],
  ])('%j → %j', (header, token) => {
    expect(bearerToken(header)).toBe(token);
  });
});

describe('requireSystemRole (OQ-111)', () => {
  /**
   * An app with one route behind the middleware, echoing the actor.
   *
   * @param claims - What token verification returns.
   * @param required - The role the route needs.
   * @returns The app.
   */
  const WITH_TOKEN = { headers: { Authorization: 'Bearer t' } };

  const appFor = (claims: typeof ACTOR | undefined, required: 'USER' | 'ADMIN') => {
    const app = new Hono<AppEnv>();
    app.onError(createErrorHandler(vi.fn()));
    const verify = vi.fn(async () => claims);
    app.get('/x', requireSystemRole(verify, required), (c) => c.json(actorOf(c)));
    return app;
  };

  it('admits a valid token with the role, making it the actor', async () => {
    const response = await appFor(ACTOR, 'USER').request('/x', WITH_TOKEN);

    expect(await response.json()).toEqual(ACTOR);
  });

  it('answers 403 auth.forbidden when the system role is missing', async () => {
    const response = await appFor(ACTOR, 'ADMIN').request('/x', WITH_TOKEN);

    expect(response.status).toBe(403);
    expect((await errorOf(response)).code).toBe('auth.forbidden');
  });

  it('answers 401 auth.unauthenticated for a missing or rejected token', async () => {
    expect((await appFor(ACTOR, 'USER').request('/x')).status).toBe(401);
    expect((await appFor(undefined, 'USER').request('/x', WITH_TOKEN)).status).toBe(401);
  });
});

describe('actorOf', () => {
  it('fails loudly on a route mounted without the middleware', async () => {
    const app = new Hono<AppEnv>();
    app.get('/x', (c) => c.json(actorOf(c)));

    expect((await app.request('/x')).status).toBe(500);
  });
});
