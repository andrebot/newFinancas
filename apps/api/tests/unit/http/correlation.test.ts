import { zError } from '@financas/api-types/zod';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { http } from '../../../src/config/constants';
import correlationIdMiddleware from '../../../src/http/correlation';
import {
  correlationIdOf, createErrorHandler, handleNotFound, type AppEnv,
} from '../../../src/http/errorHandler';

const CORRELATION_HEADER = http.correlationIdHeader;
const CLIENT_ID = '0199c5a0-1b2c-7d3e-8f40-123456789abc';
const withClientId = { headers: { [CORRELATION_HEADER]: CLIENT_ID } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Builds an app with the middleware and the real handlers: `/id` returns the
 * ID handlers see, `/boom` throws.
 *
 * @returns The app.
 */
const buildApp = () => {
  const app = new Hono<AppEnv>();
  app.onError(createErrorHandler(() => {}));
  app.notFound(handleNotFound);
  app.use(correlationIdMiddleware);
  app.get('/id', (c) => c.json({ correlationId: correlationIdOf(c) }));
  app.get('/boom', () => {
    throw new Error('boom');
  });
  return app;
};

describe('correlationIdMiddleware', () => {
  it('keeps a well-formed client ID and echoes it in the response', async () => {
    const response = await buildApp().request('/id', withClientId);

    expect(await response.json()).toEqual({ correlationId: CLIENT_ID });
    expect(response.headers.get(CORRELATION_HEADER)).toBe(CLIENT_ID);
  });

  it('mints a new ID when the client sends none or a malformed one', async () => {
    const malformed = { headers: { [CORRELATION_HEADER]: 'nope' } };
    const response = await buildApp().request('/id', malformed);
    const { correlationId } = await response.json() as { correlationId: string };

    expect(correlationId).toMatch(UUID);
    expect(response.headers.get(CORRELATION_HEADER)).toBe(correlationId);
  });

  it('gives each request its own ID', async () => {
    const app = buildApp();
    const first = (await app.request('/id')).headers.get(CORRELATION_HEADER);
    const second = (await app.request('/id')).headers.get(CORRELATION_HEADER);

    expect(first).not.toBe(second);
  });

  it('puts the same ID in the error envelope and the response header', async () => {
    const response = await buildApp().request('/boom', withClientId);
    const body = zError.parse(await response.json());

    expect(response.status).toBe(500);
    expect(body.error.correlationId).toBe(CLIENT_ID);
    expect(response.headers.get(CORRELATION_HEADER)).toBe(CLIENT_ID);
  });

  it('tags not-found responses too', async () => {
    const response = await buildApp().request('/nope', withClientId);

    expect(zError.parse(await response.json()).error.correlationId).toBe(CLIENT_ID);
    expect(response.headers.get(CORRELATION_HEADER)).toBe(CLIENT_ID);
  });
});
