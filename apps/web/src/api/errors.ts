import type { Error as ErrorEnvelope } from '@financas/api-types';
import type { ClientErrorCode } from '@financas/i18n';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

// The one error shape Experiences see (FU7, OQ-124). It is built from the API's
// envelope (OQ-83) minus `message` — English for developers only — so the UI
// cannot render it: Experiences localize `code` + `params` with I18nUtility.
// A request that never reached the API, or got an answer that isn't the
// envelope (a proxy's HTML page), gets a code of the client's own.

/** The header carrying a request's correlation ID both ways (OQ-99). */
export const CORRELATION_HEADER = 'X-Correlation-Id';

const NETWORK_UNAVAILABLE: ClientErrorCode = 'network.unavailable';
const UNEXPECTED = 'internal.unexpected';

/** One field-level validation error (`details[]`). */
export interface ApiFieldError {
  readonly field: string;
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/** A failed API call, ready to localize. */
export interface ApiError {
  /** The HTTP status; `undefined` when the API was never reached. */
  readonly status: number | undefined;
  /** An API code (`domain.reason`) or `network.unavailable`. */
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly details: readonly ApiFieldError[];
  /** Matches the server logs (NFR-OBS-1). */
  readonly correlationId: string;
}

/**
 * Narrows a response body to the API's error envelope.
 *
 * @param body - A parsed response body.
 * @returns Whether it is `{ error: { code, correlationId, … } }`.
 */
export const isErrorEnvelope = (body: unknown): body is ErrorEnvelope => {
  const error = (body as Partial<ErrorEnvelope> | null)?.error;
  return typeof error?.code === 'string' && typeof error.correlationId === 'string';
};

/**
 * Copies the envelope's displayable parts, leaving `message` behind.
 *
 * @param status - The HTTP status.
 * @param envelope - The API's error envelope.
 * @returns The error.
 */
const fromEnvelope = (status: number, { error }: ErrorEnvelope): ApiError => ({
  status,
  code: error.code,
  params: error.params ?? {},
  details: (error.details ?? []).map(({ field, code, params }) => ({
    field, code, params: params ?? {},
  })),
  correlationId: error.correlationId,
});

/**
 * Reads the HTTP status a failure carries, if the API answered at all.
 *
 * @param failure - The failure.
 * @returns The status, or `undefined` for a request that got no answer.
 */
const statusOf = (failure: FetchBaseQueryError): number | undefined => {
  if (typeof failure.status === 'number') return failure.status;
  return failure.status === 'PARSING_ERROR' ? failure.originalStatus : undefined;
};

/**
 * Turns a failed request into the error Experiences see.
 *
 * @param failure - What `fetchBaseQuery` reported.
 * @param correlationId - The ID the request was sent with.
 * @returns The envelope's error; `network.unavailable` when the API was never
 *   reached; `internal.unexpected` for any answer that isn't the envelope.
 */
export const toApiError = (failure: FetchBaseQueryError, correlationId: string): ApiError => {
  if (typeof failure.status === 'number' && isErrorEnvelope(failure.data)) {
    return fromEnvelope(failure.status, failure.data);
  }
  const unreached = failure.status === 'FETCH_ERROR' || failure.status === 'TIMEOUT_ERROR';
  return {
    status: statusOf(failure),
    code: unreached ? NETWORK_UNAVAILABLE : UNEXPECTED,
    params: {},
    details: [],
    correlationId,
  };
};
