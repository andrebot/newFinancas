import type { Error as ErrorBody } from '@financas/api-types';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { newCorrelationId, type CorrelationId } from '../utilities/correlationId';
import { isApiError, type ApiErrorInit } from './apiError';

/** Hono environment shared by the app; `correlationId` is set by `correlationIdMiddleware`. */
export interface AppEnv {
  Variables: { correlationId?: CorrelationId };
}

const UNEXPECTED: ApiErrorInit = {
  status: 500, code: 'internal.unexpected', message: 'Unexpected error',
};

/**
 * Builds the contract's error envelope (`components/schemas/Error`).
 *
 * @param init - The error description.
 * @param correlationId - Id that matches the server logs (NFR-OBS-1).
 * @returns The response body.
 */
export const toErrorBody = (init: ApiErrorInit, correlationId: string): ErrorBody => ({
  error: {
    code: init.code,
    message: init.message,
    correlationId,
    ...(init.params ? { params: init.params } : {}),
    ...(init.details ? { details: [...init.details] } : {}),
  },
});

/**
 * Reads the request's correlation ID (set by `correlationIdMiddleware`), with a
 * fresh one as a defensive default for responses produced outside that chain.
 *
 * @param c - The request context.
 * @returns The correlation ID.
 */
export const correlationIdOf = (c: Context<AppEnv>): CorrelationId => (
  c.get('correlationId') ?? newCorrelationId()
);

/**
 * Describes a non-API error: Hono's own HTTP errors keep their status (e.g. 400
 * for malformed JSON); anything else is an unexpected 500 that reveals nothing.
 *
 * @param err - The thrown error.
 * @returns The envelope description, and whether it was unexpected.
 */
const describeError = (err: Error): { init: ApiErrorInit; unexpected: boolean } => {
  if (isApiError(err)) return { init: err.apiError, unexpected: false };
  if (err instanceof HTTPException) {
    const init: ApiErrorInit = {
      status: err.status, code: 'request.invalid', message: err.message,
    };
    return { init, unexpected: false };
  }
  return { init: UNEXPECTED, unexpected: true };
};

/**
 * Creates the app-wide error handler: every thrown error leaves as the error envelope.
 *
 * @param onUnexpected - Called with errors that are not API/HTTP errors (for logging).
 * @returns The Hono `onError` handler.
 */
export const createErrorHandler = (
  onUnexpected: (err: Error) => void,
): ErrorHandler<AppEnv> => (err, c) => {
  const { init, unexpected } = describeError(err);
  if (unexpected) onUnexpected(err);
  return c.json(toErrorBody(init, correlationIdOf(c)), init.status);
};

/**
 * Not-found handler: unknown routes answer 404 `route.not_found` in the envelope.
 *
 * @param c - The request context.
 * @returns The 404 response.
 */
export const handleNotFound: NotFoundHandler<AppEnv> = (c) => c.json(
  toErrorBody(
    { status: 404, code: 'route.not_found', message: `No route for ${c.req.method} ${c.req.path}` },
    correlationIdOf(c),
  ),
  404,
);
