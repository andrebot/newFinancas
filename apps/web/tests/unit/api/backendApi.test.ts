import { configureStore } from '@reduxjs/toolkit';
import {
  describe, expect, it, vi,
} from 'vitest';
import backendApi from '../../../src/api/backendApi';
import type { ApiEnvironment } from '../../../src/api/baseQuery';
import { createTokenStore } from '../../../src/api/tokens';
import { envelope, jsonResponse, memoryStorage } from './fakes';

// The RTK Query API (BDT: API client → unit). Mocked: only `fetch`. Also the
// reference for how the App Shell wires the store (S1): reducer, middleware and
// the API environment as the thunk extra argument.

/**
 * Builds a store wired like the App Shell's, over a fake `fetch`.
 *
 * @param fetchFn - The fake `fetch`.
 * @returns The store.
 */
const storeWith = (fetchFn: typeof fetch) => {
  const environment: ApiEnvironment = {
    baseUrl: 'http://app.test/api/v1',
    fetchFn,
    tokens: createTokenStore(memoryStorage()),
    refresh: async () => 'failed',
    newCorrelationId: () => 'cid-1',
  };
  return configureStore({
    reducer: { [backendApi.reducerPath]: backendApi.reducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: { api: environment } } })
      .concat(backendApi.middleware),
  });
};

/** An Experience's endpoints, injected as `experiences/<name>/api.ts` will. */
const thingsApi = backendApi
  .enhanceEndpoints({ addTagTypes: ['Thing'] })
  .injectEndpoints({
    endpoints: (build) => ({
      getThing: build.query<{ id: string }, string>({
        query: (id) => `/things/${id}`,
        providesTags: ['Thing'],
      }),
    }),
  });

describe('backendApi', () => {
  it('runs an injected endpoint through the API base query', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { id: 'thing-1' }));
    const store = storeWith(fetchFn);

    const result = await store.dispatch(thingsApi.endpoints.getThing.initiate('thing-1'));

    expect(result.data).toEqual({ id: 'thing-1' });
    const request = fetchFn.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('http://app.test/api/v1/things/thing-1');
    expect(request.headers.get('X-Correlation-Id')).toBe('cid-1');
  });

  it('gives the Experience an ApiError on failure', async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(404, envelope('route.not_found')));
    const store = storeWith(fetchFn);

    const result = await store.dispatch(thingsApi.endpoints.getThing.initiate('missing'));

    expect(result.error).toMatchObject({
      status: 404, code: 'route.not_found', correlationId: 'server-cid',
    });
    expect(result.error).not.toHaveProperty('message');
  });
});
