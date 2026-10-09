import { createLogger } from '@financas/logging';
import type { MiddlewareHandler } from 'hono';
import { correlationIdOf, type AppEnv } from './errorHandler';

/**
 * Logs every request after it is handled — method, path, status and duration,
 * with its correlation ID (NFR-OBS-1). The actor is `unauthenticated` until the
 * authentication middleware exists.
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
    label: 'http', correlationId: correlationIdOf(c), actor: 'unauthenticated',
  });
  const { status } = c.res;
  const durationMs = Math.round(now() - started);
  const level = status >= 500 ? 'error' : 'info';
  log.log(level, `${c.req.method} ${c.req.path}`, { status, durationMs });
};

export default createRequestLogger;
