import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createDomainError } from '../utilities/domainError';
import type { AppEnv } from './errorHandler';

// Request size limit (N10 S3, OQ-249): the API never reads more than
// `maxBytes` of a request body, so a single oversized request — even an
// unauthenticated one, like a login — can't exhaust its memory. Larger bodies
// are refused as `request.too_large` (413) before any route reads them.

/**
 * Creates the middleware that refuses request bodies over a size.
 *
 * @param maxBytes - The largest body accepted, in bytes.
 * @returns Middleware that throws `request.too_large` for a larger body.
 */
const createBodySizeLimit = (maxBytes: number): MiddlewareHandler<AppEnv> => bodyLimit({
  maxSize: maxBytes,
  onError: () => {
    throw createDomainError({
      code: 'request.too_large',
      message: `Request body over ${maxBytes} bytes`,
      params: { maxBytes },
    });
  },
});

export default createBodySizeLimit;
