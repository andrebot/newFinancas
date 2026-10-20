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
  readonly crypto: Pick<Crypto, 'getRandomValues'>;
}

/**
 * Builds a correlation ID in UUID v4 form from sixteen random bytes (FU7).
 * `crypto.randomUUID` needs a secure context, but the app also runs over plain
 * HTTP on the LAN; `getRandomValues` works in both.
 *
 * @param crypto - The page's Web Crypto.
 * @returns A fresh identifier, e.g. `f47ac10b-58cc-4372-a567-0e02b2c3d479`.
 */
export const correlationIdFrom = (crypto: Pick<Crypto, 'getRandomValues'>): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Version 4 keeps the low nibble of index 6 and sets bit 0x40; variant 10xx
  // keeps the low six bits of index 8 and sets bit 0x80. The sets don't
  // overlap, so addition does what masking would (no-bitwise).
  const hex = [...bytes]
    .map((byte, index) => {
      if (index === 6) return ((byte % 16) + 64).toString(16).padStart(2, '0'); // version 4
      if (index === 8) return ((byte % 64) + 128).toString(16).padStart(2, '0'); // variant 10xx
      return byte.toString(16).padStart(2, '0');
    })
    .join('');
  const groups = [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20),
  ];
  return groups.join('-');
};

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
    newCorrelationId: () => correlationIdFrom(page.crypto),
  };
};
