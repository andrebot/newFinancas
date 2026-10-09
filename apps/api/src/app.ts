import { Hono } from 'hono';
import correlationIdMiddleware from './http/correlation';
import createRequestLogger from './http/requestLog';
import { createErrorHandler, handleNotFound, type AppEnv } from './http/errorHandler';
import type { LoggingUtility } from './utilities/logging';

/** What the app needs from its composition root. */
export interface AppDependencies {
  readonly logging: Pick<LoggingUtility, 'logError' | 'logRequest'>;
}

/**
 * Builds the API application with every route mounted.
 *
 * Kept free of I/O (no port binding, no env reads) so tests can drive it
 * in-process; `server.ts` is the only place that starts listening. Every
 * request gets a correlation ID first; every failure leaves through one error
 * handler, as the contract's error envelope carrying that ID.
 *
 * @param deps - Injected collaborators.
 * @returns A Hono app exposing `GET /health` (liveness probe).
 */
const createApp = (deps: AppDependencies): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  app.onError(createErrorHandler((error, correlationId) => deps.logging.logError({
    correlationId, actor: 'unauthenticated', action: 'http.unexpected_error', error,
  })));
  app.notFound(handleNotFound);
  app.use(correlationIdMiddleware);
  app.use(createRequestLogger(deps.logging.logRequest));
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
};

export default createApp;
