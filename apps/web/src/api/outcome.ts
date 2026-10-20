import type { SerializedError } from '@reduxjs/toolkit';
import type { MessageParams } from '../utilities/i18n';
import type { RequestFailure, RequestOutcome } from '../utilities/requestOutcome';
import type { ApiError } from './errors';

// How an Experience answers a Flow's request (X1, OQ-157): the endpoint's
// result turned into the shared `RequestOutcome` — success, or the error's
// code and params for I18nUtility. RTK Query reports an exception thrown
// while sending (not an answer from the API) as a `SerializedError`; it
// becomes `internal.unexpected`, like any answer the client can't read.

const UNEXPECTED = 'internal.unexpected';

/** What awaiting an endpoint's trigger resolves to. */
export type EndpointResult<Data> = { readonly data: Data; readonly error?: undefined } | {
  readonly data?: undefined;
  readonly error: ApiError | SerializedError;
};

/**
 * Tells the API client's errors from RTK Query's own.
 *
 * @param error - The endpoint's error.
 * @returns Whether it is an `ApiError` (it carries a correlation ID).
 */
const isApiError = (error: ApiError | SerializedError): error is ApiError => (
  'correlationId' in error && typeof error.correlationId === 'string'
);

/**
 * Turns an endpoint's error into a Flow's failure.
 *
 * @param error - The endpoint's error.
 * @returns Its code and params; `internal.unexpected` for an exception. The
 *   API only sends primitive params, so they are taken as ICU arguments.
 */
export const failureOf = (error: ApiError | SerializedError): RequestFailure => (
  isApiError(error)
    ? { code: error.code, params: error.params as MessageParams }
    : { code: UNEXPECTED }
);

/**
 * Turns an endpoint's result into the outcome a Flow gets.
 *
 * @param result - What the endpoint's trigger resolved to.
 * @returns `{ ok: true }`, or the failure.
 */
export const toRequestOutcome = (result: EndpointResult<unknown>): RequestOutcome => (
  result.error === undefined ? { ok: true } : { ok: false, error: failureOf(result.error) }
);

/** What an endpoint's answer carries on a success. */
export type DataOutcome<Data> = { readonly ok: true; readonly data: Data } | {
  readonly ok: false;
  readonly error: RequestFailure;
};

/**
 * Turns an endpoint's result into an outcome that keeps its data on a
 * success, for the Flows whose state moves with what was written.
 *
 * @param result - What the endpoint's trigger resolved to.
 * @returns `{ ok: true, data }`, or the failure.
 */
export const toDataOutcome = <Data>(result: EndpointResult<Data>): DataOutcome<Data> => (
  result.error === undefined
    ? { ok: true, data: result.data }
    : { ok: false, error: failureOf(result.error) }
);
