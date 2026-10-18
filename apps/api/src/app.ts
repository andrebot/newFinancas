import { createLogger } from '@financas/logging';
import { Hono } from 'hono';
import correlationIdMiddleware from './http/correlation';
import { createErrorHandler, handleNotFound, type AppEnv } from './http/errorHandler';
import type { VerifyAccessToken } from './http/authentication';
import createRequestLogger from './http/requestLog';
import createAccountRoutes from './http/routes/accounts';
import createCategoryRoutes from './http/routes/categories';
import createHouseholdRoutes from './http/routes/households';
import createIdentityRoutes from './http/routes/identity';
import type { AccountManager } from './managers/account';
import type { IdentityManager } from './managers/identity';

/** What the routes call: the Managers, and access-token verification. */
export interface AppDeps {
  readonly identity: IdentityManager;
  readonly account: AccountManager;
  readonly verifyAccessToken: VerifyAccessToken;
}

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
 * @param deps - The Managers and token verification the routes use.
 * @returns A Hono app exposing `GET /health` (liveness probe) and the contract's
 *   routes under `/api/v1`.
 */
const createApp = (deps: AppDeps): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  app.onError(createErrorHandler(logUnexpectedError));
  app.notFound(handleNotFound);
  app.use(correlationIdMiddleware);
  app.use(createRequestLogger());
  app.get('/health', (httpContext) => httpContext.json({ status: 'ok' }));
  app.route('/api/v1', createIdentityRoutes(deps.identity, deps.verifyAccessToken));
  // The household routes' `/households/*` guard also admits the household-data
  // routes mounted after it (OQ-174).
  app.route('/api/v1', createHouseholdRoutes(deps.identity, deps.verifyAccessToken));
  app.route('/api/v1', createCategoryRoutes(deps.account));
  app.route('/api/v1', createAccountRoutes(deps.account));
  return app;
};

export default createApp;
