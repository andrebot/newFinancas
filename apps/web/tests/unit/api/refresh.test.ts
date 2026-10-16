import { captureLogs } from '@financas/logging/browser';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { api } from '../../../src/config/constants';
import {
  browserRefreshLock, createRefresher, type RefreshLock,
} from '../../../src/api/refresh';
import { createTokenStore, type TokenStore } from '../../../src/api/tokens';
import { jsonResponse, memoryStorage, type MemoryStorage } from './fakes';

// Refresher (BDT: API client → unit). Mocked: only `fetch` and the lock's
// browser API; the token store runs over in-memory storage.

const BASE_URL = 'http://app.test/api/v1';

/** A lock that runs the task straight away. */
const noLock: RefreshLock = (task) => task();

/** What a test inspects after a refresh. */
interface Setup {
  readonly storage: MemoryStorage;
  readonly tokens: TokenStore;
  readonly fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;
}

/**
 * Builds the pieces a refresher needs, signed in with `refresh-1`.
 *
 * @param answer - What `fetch` does.
 * @param remembered - The stored refresh token.
 * @returns The pieces.
 */
const setUp = (
  answer: typeof fetch,
  remembered: string | null = 'refresh-1',
): Setup => {
  const storage = memoryStorage(remembered);
  return { storage, tokens: createTokenStore(storage), fetchFn: vi.fn(answer) };
};

/**
 * Builds the refresher over a setup.
 *
 * @param setup - Its pieces.
 * @param lock - The cross-tab lock.
 * @returns The refresher.
 */
const refresherOf = ({ tokens, fetchFn }: Setup, lock: RefreshLock = noLock) => (
  createRefresher({
    baseUrl: BASE_URL, fetchFn, tokens, lock,
  })
);

const NEW_TOKENS = { accessToken: 'access-2', refreshToken: 'refresh-2' };

describe('createRefresher', () => {
  let logs: ReturnType<typeof captureLogs>;
  beforeEach(() => {
    logs = captureLogs();
  });
  afterEach(() => logs.stop());

  it('exchanges the stored refresh token and keeps the new pair', async () => {
    const setup = setUp(async () => jsonResponse(200, NEW_TOKENS));

    await expect(refresherOf(setup)('cid-1')).resolves.toBe('refreshed');

    const [url, init] = setup.fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(`${BASE_URL}/auth/refresh`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'X-Correlation-Id': 'cid-1' });
    expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'refresh-1' });
    expect(setup.tokens.accessToken()).toBe('access-2');
    expect(setup.storage.value).toBe('refresh-2');
  });

  it('ends the session without a request when no refresh token is stored', async () => {
    const setup = setUp(async () => jsonResponse(200, NEW_TOKENS), null);

    await expect(refresherOf(setup)('cid-1')).resolves.toBe('ended');
    expect(setup.fetchFn).not.toHaveBeenCalled();
  });

  it('ends the session and forgets the tokens when the API rejects the token', async () => {
    const setup = setUp(async () => jsonResponse(401, { error: { code: 'auth.refresh_invalid' } }));
    setup.tokens.save({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    await expect(refresherOf(setup)('cid-1')).resolves.toBe('ended');
    expect(setup.tokens.accessToken()).toBeUndefined();
    expect(setup.storage.value).toBeNull();
    expect(logs.events).toEqual([expect.objectContaining({
      level: 'info', label: 'ApiClient', correlationId: 'cid-1',
    })]);
  });

  it.each<[string, typeof fetch]>([
    ['the network fails', async () => {
      throw new TypeError('Failed to fetch');
    }],
    ['the server errors', async () => jsonResponse(503, {})],
    ['the body is incomplete', async () => jsonResponse(200, { accessToken: 'access-2' })],
    ['the body has no access token', async () => jsonResponse(200, { refreshToken: 'refresh-2' })],
    ['the body isn’t JSON', async () => new Response('<html>', { status: 200 })],
  ])('fails but keeps the tokens when %s', async (_, answer) => {
    const setup = setUp(answer);

    await expect(refresherOf(setup)('cid-1')).resolves.toBe('failed');
    expect(setup.storage.value).toBe('refresh-1');
    expect(logs.events)
      .toEqual([expect.objectContaining({ level: 'warn', correlationId: 'cid-1' })]);
  });

  it('shares one exchange between concurrent calls, then starts a new one', async () => {
    const setup = setUp(async () => jsonResponse(200, NEW_TOKENS));
    const refresh = refresherOf(setup);

    const outcomes = await Promise.all([refresh('cid-1'), refresh('cid-2'), refresh('cid-3')]);
    expect(outcomes).toEqual(['refreshed', 'refreshed', 'refreshed']);
    expect(setup.fetchFn).toHaveBeenCalledTimes(1);

    await refresh('cid-4');
    expect(setup.fetchFn).toHaveBeenCalledTimes(2);
  });

  it('reads the refresh token only once it holds the lock (another tab rotated it)', async () => {
    const setup = setUp(async () => jsonResponse(200, NEW_TOKENS));
    const otherTabRotates: RefreshLock = async (task) => {
      setup.storage.value = 'refresh-from-other-tab';
      return task();
    };

    await refresherOf(setup, otherTabRotates)('cid-1');

    const [, init] = setup.fetchFn.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'refresh-from-other-tab' });
  });
});

describe('browserRefreshLock', () => {
  it('runs the task under the named Web Lock', async () => {
    const request = vi.fn(async (_: string, task: () => Promise<string>) => task());
    const lock = browserRefreshLock({ request } as unknown as LockManager);

    await expect(lock(async () => 'done')).resolves.toBe('done');
    expect(request).toHaveBeenCalledWith(api.refreshLockName, expect.any(Function));
  });

  it('runs the task directly without Web Locks', async () => {
    await expect(browserRefreshLock(undefined)(async () => 'done')).resolves.toBe('done');
  });
});
