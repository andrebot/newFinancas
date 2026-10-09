import { createLogger } from '@financas/logging';
import { Hono } from 'hono';
import correlationIdMiddleware from './http/correlation';
import { createErrorHandler, handleNotFound, type AppEnv } from './http/errorHandler';
import createRequestLogger from './http/requestLog';

/**
 * Logs an unexpected (500) error with its stack and the request's correlation
 * ID (NFR-OBS-3).
 *
 * @param error - What was thrown.
 * @param correlationId - The failing request's ID.
 */
const logUnexpectedError = (error: Error, correlationId: string): void => {
  createLogger({ label: 'http', correlationId, actor: 'unauthenticated' })
    .error(`Unexpected error: ${error.message}`, { stack: error.stack });
};

/**
 * Builds the API application with every route mounted.
 *
 * Kept free of I/O (no port binding, no env reads) so tests can drive it
 * in-process; `server.ts` is the only place that starts listening. Every
 * request gets a correlation ID first and is logged; every failure leaves
 * through one error handler, as the contract's error envelope carrying that ID.
 *
 * @returns A Hono app exposing `GET /health` (liveness probe).
 */
const createApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  app.onError(createErrorHandler(logUnexpectedError));
  app.notFound(handleNotFound);
  app.use(correlationIdMiddleware);
  app.use(createRequestLogger());
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
};

export default createApp;
