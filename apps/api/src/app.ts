import { Hono } from 'hono';

/**
 * Builds the API application with every route mounted.
 *
 * Kept free of I/O (no port binding, no env reads) so tests can drive it
 * in-process; `server.ts` is the only place that starts listening.
 *
 * @returns A Hono app exposing `GET /health` (liveness probe).
 */
const createApp = (): Hono => {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
};

export default createApp;
