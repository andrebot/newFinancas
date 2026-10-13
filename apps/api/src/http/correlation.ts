import type { MiddlewareHandler } from 'hono';
import { http } from '../config/constants';
import { resolveCorrelationId } from '../utilities/correlationId';
import type { AppEnv } from './errorHandler';

const { correlationIdHeader } = http;

/**
 * First middleware on every request: resolves the correlation ID (the client's,
 * if well-formed), stores it for handlers and the error handler, and echoes it
 * in the response so a client can quote it.
 *
 * @param httpContext - The request context.
 * @param next - The rest of the chain.
 * @returns Resolves once the request is handled.
 */
const correlationIdMiddleware: MiddlewareHandler<AppEnv> = async (httpContext, next) => {
  const correlationId = resolveCorrelationId(httpContext.req.header(correlationIdHeader));
  httpContext.set('correlationId', correlationId);
  httpContext.header(correlationIdHeader, correlationId);
  await next();
};

export default correlationIdMiddleware;
