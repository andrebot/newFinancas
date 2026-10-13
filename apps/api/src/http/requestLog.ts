import { createLogger } from '@financas/logging';
import type { MiddlewareHandler } from 'hono';
import { actorLabelOf, correlationIdOf, type AppEnv } from './errorHandler';

/**
 * Logs every request after it is handled — method, path, status and duration,
 * with its correlation ID and actor (NFR-OBS-1/2): `user:<id>` on a protected
 * route the caller was signed in for, else `unauthenticated`.
 *
 * @param now - Clock in milliseconds (injectable for tests).
 * @returns The middleware.
 */
const createRequestLogger = (
  now: () => number = () => performance.now(),
): MiddlewareHandler<AppEnv> => async (c, next) => {
  const started = now();
  await next();
  const log = createLogger({
    label: 'http', correlationId: correlationIdOf(c), actor: actorLabelOf(c),
  });
  const { status } = c.res;
  const durationMs = Math.round(now() - started);
  const level = status >= 500 ? 'error' : 'info';
  log.log(level, `${c.req.method} ${c.req.path}`, { status, durationMs });
};

export default createRequestLogger;
