import { Hono } from 'hono';
import {
  describe, expect, it, vi,
} from 'vitest';
import correlationIdMiddleware from '../../../src/http/correlation';
import { createErrorHandler, type AppEnv } from '../../../src/http/errorHandler';
import createRequestLogger from '../../../src/http/requestLog';

describe('request logger (NFR-OBS-1)', () => {
  it('logs method, path, status, duration and correlation id after each request', async () => {
    const logRequest = vi.fn();
    let clock = 100;
    const app = new Hono<AppEnv>();
    app.onError(createErrorHandler(() => {}));
    app.use(correlationIdMiddleware);
    app.use(createRequestLogger(logRequest, () => clock));
    app.get('/slow', (c) => {
      clock += 42;
      return c.json({});
    });
    app.get('/boom', () => {
      throw new Error('x');
    });

    const ok = await app.request('/slow');
    await app.request('/boom');

    expect(logRequest).toHaveBeenNthCalledWith(1, {
      correlationId: ok.headers.get('x-correlation-id'),
      actor: 'unauthenticated',
      method: 'GET',
      path: '/slow',
      status: 200,
      durationMs: 42,
    });
    expect(logRequest)
      .toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/boom', status: 500 }));
  });

  it('uses the real clock by default', async () => {
    const logRequest = vi.fn();
    const app = new Hono<AppEnv>();
    app.use(createRequestLogger(logRequest));
    app.get('/', (c) => c.text('ok'));

    await app.request('/');

    expect(logRequest.mock.calls[0]![0].durationMs).toBeGreaterThanOrEqual(0);
  });
});
