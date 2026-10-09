import type { MiddlewareHandler } from 'hono';
import { resolveCorrelationId } from '../utilities/correlationId';
import type { AppEnv } from './errorHandler';

/** Request and response header carrying the correlation ID. */
export const CORRELATION_HEADER = 'X-Correlation-Id';

/**
 * First middleware on every request: resolves the correlation ID (the client's,
 * if well-formed), stores it for handlers and the error handler, and echoes it
 * in the response so a client can quote it.
 *
 * @param c - The request context.
 * @param next - The rest of the chain.
 * @returns Resolves once the request is handled.
 */
export const correlationIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const correlationId = resolveCorrelationId(c.req.header(CORRELATION_HEADER));
  c.set('correlationId', correlationId);
  c.header(CORRELATION_HEADER, correlationId);
  await next();
};
