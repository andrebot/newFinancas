import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { api } from '../../../src/config/constants';
import { browserApiEnvironment, correlationIdFrom, type ApiWindow } from '../../../src/api/environment';
import { jsonResponse } from './fakes';

// The browser environment (BDT: API client → unit). Mocked: `fetch`, Web Locks
// and `crypto` on a fake window; jsdom's own localStorage.

/** A page crypto whose random bytes are all `value`. */
const fixedCrypto = (value: number): Pick<Crypto, 'getRandomValues'> => ({
  getRandomValues(buffer) {
    (buffer as unknown as Uint8Array).fill(value);
    return buffer;
  },
});

/**
 * Builds a fake page on `http://app.test` — deliberately not a secure context,
 * so the environment must work without `crypto.randomUUID`.
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
  crypto: fixedCrypto(0xab),
});

describe('correlationIdFrom', () => {
  it('masks the version and variant bytes into UUID v4 form', () => {
    expect(correlationIdFrom(fixedCrypto(0xab)))
      .toBe('abababab-abab-4bab-abab-abababababab');
  });

  it('keeps high bits out of the masked positions', () => {
    expect(correlationIdFrom(fixedCrypto(0xff)))
      .toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('makes unique, well-formed IDs from real random bytes', () => {
    const first = correlationIdFrom(crypto);
    const second = correlationIdFrom(crypto);

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
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

  it('makes correlation IDs from getRandomValues, without randomUUID', () => {
    expect(browserApiEnvironment(pageWith(vi.fn())).newCorrelationId())
      .toBe('abababab-abab-4bab-abab-abababababab');
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
