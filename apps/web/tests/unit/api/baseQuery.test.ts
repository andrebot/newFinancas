import { captureLogs } from '@financas/logging/browser';
import type { BaseQueryApi } from '@reduxjs/toolkit/query';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  apiBaseQuery, sessionEnded, type ApiEnvironment,
} from '../../../src/api/baseQuery';
import type { RefreshOutcome } from '../../../src/api/refresh';
import { createTokenStore, type TokenStore } from '../../../src/api/tokens';
import { envelope, jsonResponse, memoryStorage } from './fakes';

// Base query (BDT: API client → unit). Mocked: `fetch` and the refresher (the
// one boundary each); the token store runs over in-memory storage.

const BASE_URL = 'http://app.test/api/v1';

/** What a test sets up and inspects. */
interface Harness {
  readonly environment: ApiEnvironment;
  readonly tokens: TokenStore;
  readonly fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly refresh: ReturnType<typeof vi.fn<(correlationId: string) => Promise<RefreshOutcome>>>;
  readonly queryApi: BaseQueryApi;
  readonly dispatch: ReturnType<typeof vi.fn>;
}

/**
 * Builds a base-query harness answering each request with the next response.
 *
 * @param responses - What `fetch` answers, in order.
 * @param outcome - What a refresh reports; a `refreshed` one saves `access-2`.
 * @returns The harness.
 */
const harness = (responses: Response[], outcome: RefreshOutcome = 'refreshed'): Harness => {
  const tokens = createTokenStore(memoryStorage());
  const fetchFn = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchFn.mockResolvedValueOnce(response));
  const refresh = vi.fn(async () => {
    if (outcome === 'refreshed') {
      tokens.save({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    }
    return outcome;
  });
  const environment: ApiEnvironment = {
    baseUrl: BASE_URL, fetchFn, tokens, refresh, newCorrelationId: () => 'cid-1',
  };
  const dispatch = vi.fn();
  const queryApi = {
    signal: new AbortController().signal,
    abort: vi.fn(),
    dispatch,
    getState: () => ({}),
    extra: { api: environment },
    endpoint: 'getThing',
    type: 'query',
  } satisfies BaseQueryApi;
  return {
    environment, tokens, fetchFn, refresh, queryApi, dispatch,
  };
};

/**
 * The request `fetch` received on a given call.
 *
 * @param fetchFn - The fake `fetch`.
 * @param call - Which call (0-based).
 * @returns The request.
 */
const requestOf = (fetchFn: Harness['fetchFn'], call = 0): Request => (
  fetchFn.mock.calls[call]?.[0] as Request
);

const UNAUTHENTICATED = () => jsonResponse(401, envelope('auth.unauthenticated'));

describe('apiBaseQuery', () => {
  let logs: ReturnType<typeof captureLogs>;
  beforeEach(() => {
    logs = captureLogs();
  });
  afterEach(() => logs.stop());

  it('sends under the base URL with a correlation ID and returns the data', async () => {
    const { fetchFn, queryApi } = harness([jsonResponse(200, { id: 'thing-1' })]);

    const args = { url: '/things', method: 'POST', body: { a: 1 } };
    const result = await apiBaseQuery(args, queryApi, {});

    expect(result.data).toEqual({ id: 'thing-1' });
    const request = requestOf(fetchFn);
    expect(request.url).toBe(`${BASE_URL}/things`);
    expect(request.method).toBe('POST');
    expect(request.headers.get('X-Correlation-Id')).toBe('cid-1');
    expect(request.headers.has('Authorization')).toBe(false);
  });

  it('sends the access token as a bearer token', async () => {
    const { fetchFn, queryApi, tokens } = harness([jsonResponse(204)]);
    tokens.save({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    await apiBaseQuery('/things', queryApi, {});

    expect(requestOf(fetchFn).headers.get('Authorization')).toBe('Bearer access-1');
  });

  it('returns a domain failure as ApiError, without logging it', async () => {
    const conflict = jsonResponse(409, envelope('budget.target_already_claimed'));
    const { queryApi, refresh } = harness([conflict]);

    const result = await apiBaseQuery('/budgets', queryApi, {});

    expect(result.error).toMatchObject({ status: 409, code: 'budget.target_already_claimed' });
    expect(result.error).not.toHaveProperty('message');
    expect(result.meta?.response?.status).toBe(409);
    expect(refresh).not.toHaveBeenCalled();
    expect(logs.events).toEqual([]);
  });

  it.each(['auth.invalid_credentials', 'auth.refresh_invalid', 'auth.mfa_invalid'])(
    'never refreshes on a 401 %s (not an expired access token)',
    async (code) => {
      const { queryApi, refresh } = harness([jsonResponse(401, envelope(code))]);

      const result = await apiBaseQuery('/auth/login', queryApi, {});

      expect(result.error?.code).toBe(code);
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it('refreshes on 401 auth.unauthenticated, replays with the new token and same ID', async () => {
    const {
      fetchFn, queryApi, refresh, dispatch,
    } = harness([UNAUTHENTICATED(), jsonResponse(200, { id: 'thing-1' })]);

    const result = await apiBaseQuery('/things', queryApi, {});

    expect(result.data).toEqual({ id: 'thing-1' });
    expect(refresh).toHaveBeenCalledWith('cid-1');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(requestOf(fetchFn, 1).headers.get('Authorization')).toBe('Bearer access-2');
    expect(requestOf(fetchFn, 1).headers.get('X-Correlation-Id')).toBe('cid-1');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('replays only once: a second 401 is returned as is', async () => {
    const { fetchFn, queryApi, refresh } = harness([UNAUTHENTICATED(), UNAUTHENTICATED()]);

    const result = await apiBaseQuery('/things', queryApi, {});

    expect(result.error?.code).toBe('auth.unauthenticated');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('dispatches sessionEnded and returns the 401 when the session can’t be renewed', async () => {
    const { fetchFn, queryApi, dispatch } = harness([UNAUTHENTICATED()], 'ended');

    const result = await apiBaseQuery('/things', queryApi, {});

    expect(result.error).toMatchObject({ status: 401, code: 'auth.unauthenticated' });
    expect(dispatch).toHaveBeenCalledWith(sessionEnded());
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns the 401 without ending the session when the refresh got no answer', async () => {
    const { fetchFn, queryApi, dispatch } = harness([UNAUTHENTICATED()], 'failed');

    const result = await apiBaseQuery('/things', queryApi, {});

    expect(result.error?.code).toBe('auth.unauthenticated');
    expect(dispatch).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns network.unavailable and warns when the API can’t be reached', async () => {
    const { fetchFn, queryApi } = harness([]);
    fetchFn.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await apiBaseQuery('/things', queryApi, {});

    expect(result.error).toEqual({
      status: undefined,
      code: 'network.unavailable',
      params: {},
      details: [],
      correlationId: 'cid-1',
    });
    expect(logs.events).toEqual([expect.objectContaining({
      level: 'warn', endpoint: 'getThing', code: 'network.unavailable', correlationId: 'cid-1',
    })]);
  });

  it.each([
    ['a server error', jsonResponse(500, envelope('internal.unexpected'))],
    ['an answer that isn’t the envelope', new Response('<html>', { status: 502 })],
  ])('logs %s as an error', async (_, response) => {
    const { queryApi } = harness([response]);

    const result = await apiBaseQuery('/things', queryApi, {});

    expect(result.error?.code).toBe('internal.unexpected');
    expect(logs.events)
      .toEqual([expect.objectContaining({ level: 'error', endpoint: 'getThing' })]);
  });

  it('refuses to run in a store configured without an API environment', async () => {
    const { queryApi } = harness([]);

    await expect(apiBaseQuery('/things', { ...queryApi, extra: undefined }, {}))
      .rejects.toThrow('no API environment');
  });
});
