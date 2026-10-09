import { Hono } from 'hono';
import correlationIdMiddleware from './http/correlation';
import { createErrorHandler, handleNotFound, type AppEnv } from './http/errorHandler';

/** What the app needs from its composition root. */
export interface AppDependencies {
  /** Receives unexpected (500) errors; LoggingUtility (U2) will provide it. */
  readonly onUnexpectedError: (err: Error) => void;
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
  app.onError(createErrorHandler(deps.onUnexpectedError));
  app.notFound(handleNotFound);
  app.use(correlationIdMiddleware);
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
};

export default createApp;
