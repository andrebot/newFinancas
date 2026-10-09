import { zError } from '@financas/api-types/zod';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  describe, expect, it, vi,
} from 'vitest';
import { createApiError } from '../../../src/http/apiError';
import {
  correlationIdOf, createErrorHandler, handleNotFound, toErrorBody, type AppEnv,
} from '../../../src/http/errorHandler';
import { newCorrelationId, type CorrelationId } from '../../../src/utilities/correlationId';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Builds an app whose only route throws `thrown`, wired with the real handlers.
 *
 * @param thrown - What the route throws.
 * @param correlationId - Optional ID set on the context, as `correlationIdMiddleware` does.
 * @returns The app and the unexpected-error spy.
 */
const appThrowing = (thrown: unknown, correlationId?: CorrelationId) => {
  const onUnexpected = vi.fn();
  const app = new Hono<AppEnv>();
  app.onError(createErrorHandler(onUnexpected));
  app.notFound(handleNotFound);
  app.use(async (c, next) => {
    if (correlationId) c.set('correlationId', correlationId);
    await next();
  });
  app.get('/boom', () => {
    throw thrown;
  });
  return { app, onUnexpected };
};

describe('toErrorBody', () => {
  it('includes params and details only when present', () => {
    expect(toErrorBody({ status: 404, code: 'request.invalid', message: 'm' }, 'cid'))
      .toEqual({ error: { code: 'request.invalid', message: 'm', correlationId: 'cid' } });
    expect(toErrorBody({
      status: 422,
      code: 'request.invalid',
      message: 'm',
      params: { x: 1 },
      details: [{ field: 'f', code: 'field.required' }],
    }, 'cid')).toEqual({
      error: {
        code: 'request.invalid',
        message: 'm',
        correlationId: 'cid',
        params: { x: 1 },
        details: [{ field: 'f', code: 'field.required' }],
      },
    });
  });
});

describe('correlationIdOf', () => {
  it('uses the id set on the request, or generates a UUID', async () => {
    const id = newCorrelationId(() => '0199c5a0-0000-7000-8000-000000000001');
    const { app } = appThrowing(new Error('x'), id);
    const withId = zError.parse(await (await app.request('/boom')).json());
    const withoutIdResponse = await appThrowing(new Error('x')).app.request('/boom');
    const withoutId = zError.parse(await withoutIdResponse.json());

    expect(withId.error.correlationId).toBe(id);
    expect(withoutId.error.correlationId).toMatch(UUID);
    expect(correlationIdOf).toBeTypeOf('function');
  });
});

describe('createErrorHandler', () => {
  it('renders an API error with its own status, code and params', async () => {
    const { app, onUnexpected } = appThrowing(createApiError({
      status: 409,
      code: 'goal.allocation_exceeds_100',
      message: 'Over',
      params: { current: 85, requested: 30 },
    }));

    const response = await app.request('/boom');
    const body = zError.parse(await response.json());

    expect(response.status).toBe(409);
    expect(body.error).toMatchObject({
      code: 'goal.allocation_exceeds_100', params: { current: 85, requested: 30 },
    });
    expect(onUnexpected).not.toHaveBeenCalled();
  });

  it('keeps the status of Hono HTTP errors as request.invalid', async () => {
    const malformed = new HTTPException(400, { message: 'Malformed JSON' });
    const { app, onUnexpected } = appThrowing(malformed);

    const response = await app.request('/boom');
    const body = zError.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({ code: 'request.invalid', message: 'Malformed JSON' });
    expect(onUnexpected).not.toHaveBeenCalled();
  });

  it('turns anything else into a 500 that reveals nothing, and reports it', async () => {
    const secret = new Error('db password is hunter2');
    const { app, onUnexpected } = appThrowing(secret);

    const response = await app.request('/boom');
    const body = zError.parse(await response.json());

    expect(response.status).toBe(500);
    expect(body.error).toMatchObject({ code: 'internal.unexpected', message: 'Unexpected error' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(onUnexpected).toHaveBeenCalledWith(secret, body.error.correlationId);
  });
});

describe('handleNotFound', () => {
  it('answers unknown routes with 404 route.not_found in the envelope', async () => {
    const response = await appThrowing(null).app.request('/nope', { method: 'DELETE' });
    const body = zError.parse(await response.json());

    expect(response.status).toBe(404);
    expect(body.error)
      .toMatchObject({ code: 'route.not_found', message: 'No route for DELETE /nope' });
  });
});
