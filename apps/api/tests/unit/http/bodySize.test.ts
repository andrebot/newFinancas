import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import createBodySizeLimit from '../../../src/http/bodySize';
import { createErrorHandler, type AppEnv } from '../../../src/http/errorHandler';

// The request size limit (N10 S3, OQ-249): bodies over the limit are refused
// as `request.too_large` before the route reads them.

/**
 * Builds an app with the limit in front of one route that reads its body.
 *
 * @param maxBytes - The limit under test.
 * @returns The app, and how many times the route ran.
 */
const appWithLimit = (maxBytes: number) => {
  const reached = { count: 0 };
  const app = new Hono<AppEnv>();
  app.onError(createErrorHandler(() => {}));
  app.use(createBodySizeLimit(maxBytes));
  app.post('/echo', async (httpContext) => {
    reached.count += 1;
    return httpContext.json({ length: (await httpContext.req.text()).length });
  });
  return { app, reached };
};

/**
 * Posts a body of `size` bytes.
 *
 * @param app - The app under test.
 * @param size - The body's length.
 * @returns The response.
 */
const postBody = (app: Hono<AppEnv>, size: number) => app.request('/echo', {
  method: 'POST',
  headers: { 'content-type': 'text/plain' },
  body: 'x'.repeat(size),
});

describe('createBodySizeLimit', () => {
  it('lets a body of exactly the limit through to the route', async () => {
    const { app, reached } = appWithLimit(16);

    const response = await postBody(app, 16);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ length: 16 });
    expect(reached.count).toBe(1);
  });

  it('refuses a larger body as request.too_large (413) without running the route', async () => {
    const { app, reached } = appWithLimit(16);

    const response = await postBody(app, 17);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: {
        code: 'request.too_large',
        message: 'Request body over 16 bytes',
        params: { maxBytes: 16 },
      },
    });
    expect(reached.count).toBe(0);
  });
});
