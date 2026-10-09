import { captureLogs } from '@financas/logging';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import correlationIdMiddleware from '../../../src/http/correlation';
import { createErrorHandler, type AppEnv } from '../../../src/http/errorHandler';
import createRequestLogger from '../../../src/http/requestLog';

describe('request logger (NFR-OBS-1)', () => {
  it('logs method, path, status, duration and correlation id after each request', async () => {
    let clock = 100;
    const app = new Hono<AppEnv>();
    app.onError(createErrorHandler(() => {}));
    app.use(correlationIdMiddleware);
    app.use(createRequestLogger(() => clock));
    app.get('/slow', (c) => {
      clock += 42;
      return c.json({});
    });
    app.get('/boom', () => {
      throw new Error('x');
    });
    const logs = captureLogs();

    const ok = await app.request('/slow');
    await app.request('/boom');
    logs.stop();

    expect(logs.events[0]).toMatchObject({
      level: 'info',
      label: 'http',
      message: 'GET /slow',
      correlationId: ok.headers.get('x-correlation-id'),
      actor: 'unauthenticated',
      status: 200,
      durationMs: 42,
    });
    expect(logs.events[1]).toMatchObject({ level: 'error', message: 'GET /boom', status: 500 });
  });

  it('uses the real clock by default', async () => {
    const app = new Hono<AppEnv>();
    app.use(createRequestLogger());
    app.get('/', (c) => c.text('ok'));
    const logs = captureLogs();

    await app.request('/');
    logs.stop();

    expect(logs.events[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
