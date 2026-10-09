import type { MiddlewareHandler } from 'hono';
import type { LoggingUtility } from '../utilities/logging';
import { correlationIdOf, type AppEnv } from './errorHandler';

/**
 * Logs every request after it is handled — method, path, status and duration,
 * with its correlation ID (NFR-OBS-1). The actor is `unauthenticated` until the
 * authentication middleware exists.
 *
 * @param logRequest - LoggingUtility.logRequest.
 * @param now - Clock in milliseconds (injectable for tests).
 * @returns The middleware.
 */
const createRequestLogger = (
  logRequest: LoggingUtility['logRequest'],
  now: () => number = () => performance.now(),
): MiddlewareHandler<AppEnv> => async (c, next) => {
  const started = now();
  await next();
  logRequest({
    correlationId: correlationIdOf(c),
    actor: 'unauthenticated',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Math.round(now() - started),
  });
};

export default createRequestLogger;
