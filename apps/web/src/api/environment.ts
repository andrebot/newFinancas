import { api } from '../config/constants';
import { safeStorage } from '../utilities/safeStorage';
import type { ApiEnvironment } from './baseQuery';
import { browserRefreshLock, createRefresher } from './refresh';
import { createTokenStore } from './tokens';

// The API client's real surroundings in the browser (FU7): the page's origin,
// `fetch`, `localStorage` for the refresh token, Web Locks and `crypto`.

/** The parts of `window` the API client uses. */
export interface ApiWindow {
  readonly fetch: typeof fetch;
  readonly localStorage: Storage;
  readonly location: Pick<Location, 'origin'>;
  /** `locks` is missing in browsers older than the ones we support. */
  readonly navigator: { readonly locks?: LockManager | undefined };
  readonly crypto: Pick<Crypto, 'randomUUID'>;
}

/**
 * Builds the API environment for a page.
 *
 * @param page - The page's `window`.
 * @returns The environment the App Shell gives the store (S1).
 */
export const browserApiEnvironment = (page: ApiWindow): ApiEnvironment => {
  const baseUrl = `${page.location.origin}${api.baseUrl}`;
  const fetchFn: typeof fetch = (input, init) => page.fetch(input, init);
  const tokens = createTokenStore(safeStorage(() => page.localStorage, api.refreshTokenStorageKey));
  const lock = browserRefreshLock(page.navigator.locks);

  return {
    baseUrl,
    fetchFn,
    tokens,
    refresh: createRefresher({
      baseUrl, fetchFn, tokens, lock,
    }),
    newCorrelationId: () => page.crypto.randomUUID(),
  };
};
