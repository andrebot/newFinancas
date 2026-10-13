import { createLogger } from '@financas/logging/browser';
import { createAction } from '@reduxjs/toolkit';
import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
  type FetchBaseQueryMeta,
  type QueryReturnValue,
} from '@reduxjs/toolkit/query';
import {
  CORRELATION_HEADER, isErrorEnvelope, toApiError, type ApiError,
} from './errors';
import type { Refresher } from './refresh';
import type { TokenStore } from './tokens';

// How every Experience request reaches the API (FU7, OQ-124): RTK Query's
// base query, wrapping `fetchBaseQuery` with what every call needs —
// - a correlation ID per call (OQ-99), kept when the call is replayed;
// - the access token as a bearer token;
// - on 401 `auth.unauthenticated` (no or an expired access token — never a
//   wrong password, `auth.invalid_credentials`), one refresh and one replay;
//   a refresh the API rejects ends the session: `sessionEnded` is dispatched
//   and the App Shell takes the user to Sign In (S1);
// - failures as `ApiError`, without the envelope's `message`.
// What it talks to arrives as the store's thunk extra argument, so tests and
// the App Shell choose it without touching this module.

const log = createLogger({ label: 'ApiClient' });

/** What the API client needs from the page. */
export interface ApiEnvironment {
  /** The API's absolute base URL (`https://host/api/v1`). */
  readonly baseUrl: string;
  readonly fetchFn: typeof fetch;
  readonly tokens: TokenStore;
  readonly refresh: Refresher;
  readonly newCorrelationId: () => string;
}

/** The store's thunk extra argument (configured by the App Shell, S1). */
export interface ApiExtra {
  readonly api: ApiEnvironment;
}

/** Dispatched when the session can't be renewed; the user must sign in again. */
export const sessionEnded = createAction('api/sessionEnded');

/** The base query every Experience endpoint goes through. */
export type ApiBaseQuery = BaseQueryFn<
  string | FetchArgs, unknown, ApiError, object, FetchBaseQueryMeta
>;

type SentResult = QueryReturnValue<unknown, FetchBaseQueryError, FetchBaseQueryMeta>;

/**
 * Finds the API environment in the store's thunk extra argument.
 *
 * @param extra - The thunk extra argument.
 * @returns The environment.
 * @throws {Error} When the store was configured without one (a wiring bug).
 */
const environmentOf = (extra: unknown): ApiEnvironment => {
  const environment = (extra as Partial<ApiExtra> | undefined)?.api;
  if (!environment) {
    throw new Error('The store has no API environment (thunk extra argument `api`)');
  }
  return environment;
};

/**
 * Builds the sender for one call: `fetchBaseQuery` adding the call's
 * correlation ID and the current access token (read on every send, so a
 * replay carries the refreshed one).
 *
 * @param environment - Where to send it and with which tokens.
 * @param correlationId - The call's correlation ID.
 * @returns The sender.
 */
const createSender = (environment: ApiEnvironment, correlationId: string) => fetchBaseQuery({
  baseUrl: environment.baseUrl,
  fetchFn: environment.fetchFn,
  prepareHeaders: (headers) => {
    headers.set(CORRELATION_HEADER, correlationId);
    const accessToken = environment.tokens.accessToken();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return headers;
  },
});

/**
 * Tells whether a failure only means the access token is missing or expired.
 *
 * @param failure - The failure, if the call failed.
 * @returns `true` for a 401 `auth.unauthenticated`.
 */
const needsNewAccessToken = (failure: FetchBaseQueryError | undefined): boolean => (
  failure?.status === 401
  && isErrorEnvelope(failure.data)
  && failure.data.error.code === 'auth.unauthenticated'
);

/**
 * Logs what the user can't fix: no answer (warning), or a server error or an
 * answer that isn't the envelope (error). Expected 4xx outcomes are the
 * Experience's to show, and the API has logged them already.
 *
 * @param endpoint - The RTK Query endpoint.
 * @param error - The failure.
 */
const logFailure = (endpoint: string, error: ApiError): void => {
  const details = {
    endpoint, status: error.status, code: error.code, correlationId: error.correlationId,
  };
  if (error.status === undefined) {
    log.warn('API unreachable', details);
  } else if (error.status >= 500 || error.code === 'internal.unexpected') {
    log.error('API request failed', details);
  }
};

/**
 * Turns a sent call's result into the base query's: data as is, a failure as
 * `ApiError`.
 *
 * @param result - What `fetchBaseQuery` returned.
 * @param endpoint - The RTK Query endpoint, for the log.
 * @param correlationId - The call's correlation ID.
 * @returns The result Experiences see.
 */
const settle = (
  result: SentResult,
  endpoint: string,
  correlationId: string,
): QueryReturnValue<unknown, ApiError, FetchBaseQueryMeta> => {
  if (!result.error) return result;
  const error = toApiError(result.error, correlationId);
  logFailure(endpoint, error);
  return { ...result, error };
};

/**
 * Sends one Experience request: see the module comment for what it adds.
 *
 * @param args - The endpoint's URL or fetch arguments (relative to the base URL).
 * @param queryApi - RTK Query's API (thunk extra argument, dispatch, endpoint).
 * @param extraOptions - RTK Query's extra options, passed through.
 * @returns The data, or the `ApiError`.
 */
export const apiBaseQuery: ApiBaseQuery = async (args, queryApi, extraOptions) => {
  const environment = environmentOf(queryApi.extra);
  const correlationId = environment.newCorrelationId();
  const send = createSender(environment, correlationId);
  const attempt = () => send(args, queryApi, extraOptions);

  const first = await attempt();
  if (!needsNewAccessToken(first.error)) return settle(first, queryApi.endpoint, correlationId);

  const outcome = await environment.refresh(correlationId);
  if (outcome === 'ended') queryApi.dispatch(sessionEnded());
  const result = outcome === 'refreshed' ? await attempt() : first;
  return settle(result, queryApi.endpoint, correlationId);
};
