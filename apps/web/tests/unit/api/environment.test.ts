import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { api } from '../../../src/config/constants';
import { browserApiEnvironment, type ApiWindow } from '../../../src/api/environment';
import { jsonResponse } from './fakes';

// The browser environment (BDT: API client → unit). Mocked: `fetch`, Web Locks
// and `crypto` on a fake window; jsdom's own localStorage.

/**
 * Builds a fake page on `http://app.test`.
 *
 * @param fetchFn - The page's `fetch`.
 * @param locks - The page's Web Locks, if any.
 * @returns The page.
 */
const pageWith = (fetchFn: typeof fetch, locks?: LockManager): ApiWindow => ({
  fetch: fetchFn,
  localStorage: window.localStorage,
  location: { origin: 'http://app.test' },
  navigator: { locks },
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
});

describe('browserApiEnvironment', () => {
  afterEach(() => localStorage.clear());

  it('points at the API on the page’s own origin', () => {
    expect(browserApiEnvironment(pageWith(vi.fn())).baseUrl).toBe('http://app.test/api/v1');
  });

  it('sends through the page’s fetch', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(204));
    const environment = browserApiEnvironment(pageWith(fetchFn));

    await environment.fetchFn('http://app.test/api/v1/things', { method: 'GET' });

    expect(fetchFn).toHaveBeenCalledWith('http://app.test/api/v1/things', { method: 'GET' });
  });

  it('keeps the refresh token in localStorage', () => {
    const environment = browserApiEnvironment(pageWith(vi.fn()));
    environment.tokens.save({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    expect(localStorage.getItem(api.refreshTokenStorageKey)).toBe('refresh-1');
  });

  it('makes correlation IDs with crypto.randomUUID', () => {
    expect(browserApiEnvironment(pageWith(vi.fn())).newCorrelationId())
      .toBe('00000000-0000-4000-8000-000000000001');
  });

  it('refreshes against the same API, under the page’s Web Lock', async () => {
    localStorage.setItem(api.refreshTokenStorageKey, 'refresh-1');
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' }));
    const request = vi.fn(async (_: string, task: () => Promise<unknown>) => task());
    const locks = { request } as unknown as LockManager;
    const environment = browserApiEnvironment(pageWith(fetchFn, locks));

    await expect(environment.refresh('cid-1')).resolves.toBe('refreshed');
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://app.test/api/v1/auth/refresh');
    expect(request).toHaveBeenCalledWith(api.refreshLockName, expect.any(Function));
    expect(environment.tokens.accessToken()).toBe('access-2');
  });
});
