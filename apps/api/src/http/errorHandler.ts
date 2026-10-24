import type { Error as ErrorBody } from '@financas/api-types';
import { actorLabel } from '@financas/logging';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AccessTokenClaims } from '../utilities/authentication';
import { newCorrelationId, type CorrelationId } from '../utilities/correlationId';
import { isDomainError, type DomainErrorInit } from '../utilities/domainError';
import STATUS_OF from './errorStatus';

/**
 * Hono environment shared by the app: `correlationId` is set by
 * `correlationIdMiddleware`, `actor` by the authentication middleware on
 * protected routes.
 */
export interface AppEnv {
  Variables: { correlationId?: CorrelationId; actor?: AccessTokenClaims };
}

const UNEXPECTED: DomainErrorInit = { code: 'internal.unexpected', message: 'Unexpected error' };

/** How an error is answered: the envelope's content, its status and any headers. */
interface Answer {
  readonly init: DomainErrorInit;
  readonly status: ContentfulStatusCode;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Builds the contract's error envelope (`components/schemas/Error`).
 *
 * @param init - The error description.
 * @param correlationId - Id that matches the server logs (NFR-OBS-1).
 * @returns The response body.
 */
export const toErrorBody = (init: DomainErrorInit, correlationId: string): ErrorBody => ({
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
 * @param httpContext - The request context.
 * @returns The correlation ID.
 */
export const correlationIdOf = (httpContext: Context<AppEnv>): CorrelationId => (
  httpContext.get('correlationId') ?? newCorrelationId()
);

/**
 * The request's actor label for logs (NFR-OBS-2): `user:<id>` once the
 * authentication middleware has run, else `unauthenticated`.
 *
 * @param httpContext - The request context.
 * @returns The actor label.
 */
export const actorLabelOf = (httpContext: Context<AppEnv>): string => {
  const actor = httpContext.get('actor');
  return actor ? actorLabel({ userId: actor.userId }) : actorLabel('unauthenticated');
};

/**
 * Answers a refusal (OQ-202): its status is its code's (`STATUS_OF`), and a
 * wait it names becomes `Retry-After`.
 *
 * @param init - The refusal.
 * @returns How it is answered.
 */
export const answerOf = (init: DomainErrorInit): Answer => ({
  init,
  status: STATUS_OF[init.code],
  ...(init.retryAfterSeconds === undefined
    ? {}
    : { headers: { 'Retry-After': String(init.retryAfterSeconds) } }),
});

/**
 * Describes any thrown error: a refusal is answered by its code; Hono's own
 * HTTP errors keep their status (e.g. 400 for malformed JSON); anything else
 * is an unexpected 500 that reveals nothing.
 *
 * @param err - The thrown error.
 * @returns How it is answered, and whether it was unexpected.
 */
const describeError = (err: Error): { answer: Answer; unexpected: boolean } => {
  if (isDomainError(err)) return { answer: answerOf(err.domainError), unexpected: false };
  if (err instanceof HTTPException) {
    const init: DomainErrorInit = { code: 'request.invalid', message: err.message };
    return { answer: { init, status: err.status }, unexpected: false };
  }
  return { answer: answerOf(UNEXPECTED), unexpected: true };
};

/**
 * Creates the app-wide error handler: every thrown error leaves as the error envelope.
 *
 * @param onUnexpected - Called with errors that are not API/HTTP errors and the
 *   request's correlation ID (logged as an error with its stack).
 * @returns The Hono `onError` handler.
 */
export const createErrorHandler = (
  onUnexpected: (err: Error, correlationId: string) => void,
): ErrorHandler<AppEnv> => (err, httpContext) => {
  const { answer, unexpected } = describeError(err);
  const correlationId = correlationIdOf(httpContext);
  if (unexpected) onUnexpected(err, correlationId);
  return httpContext.json(toErrorBody(answer.init, correlationId), answer.status, answer.headers);
};

/**
 * Not-found handler: unknown routes answer 404 `route.not_found` in the envelope.
 *
 * @param httpContext - The request context.
 * @returns The 404 response.
 */
export const handleNotFound: NotFoundHandler<AppEnv> = (httpContext) => httpContext.json(
  toErrorBody(
    {
      code: 'route.not_found',
      message: `No route for ${httpContext.req.method} ${httpContext.req.path}`,
    },
    correlationIdOf(httpContext),
  ),
  STATUS_OF['route.not_found'],
);
