import type { RefreshTokensData, RefreshTokensResponse } from '@financas/api-types';
import { createLogger } from '@financas/logging/browser';
import { api } from '../config/constants';
import { CORRELATION_HEADER } from './errors';
import type { TokenStore } from './tokens';

// Getting a new access token (FU7, OQ-124). The backend rotates the refresh
// token on every use and ends the session when one is presented twice
// (OQ-100), so a refresh must never run twice on the same token: requests in
// this tab share one exchange, and every tab takes the same Web Lock and reads
// the token from storage only once it holds it.

const log = createLogger({ label: 'ApiClient' });

/**
 * How a refresh ended: new tokens, the session is over (the refresh token was
 * missing or rejected), or no answer (network, server error) — tokens kept.
 */
export type RefreshOutcome = 'refreshed' | 'ended' | 'failed';

/** Runs a task while holding the cross-tab refresh lock. */
export type RefreshLock = <Result>(task: () => Promise<Result>) => Promise<Result>;

/** Exchanges the refresh token; concurrent calls share one exchange. */
export type Refresher = (correlationId: string) => Promise<RefreshOutcome>;

/** What a refresh needs. */
export interface RefresherEnvironment {
  /** The API's absolute base URL (`https://host/api/v1`). */
  readonly baseUrl: string;
  readonly fetchFn: typeof fetch;
  readonly tokens: TokenStore;
  readonly lock: RefreshLock;
}

/**
 * Narrows a response body to a complete token pair.
 *
 * @param body - The parsed `POST /auth/refresh` body.
 * @returns Whether both tokens are present.
 */
const isTokenPair = (body: unknown): body is Required<RefreshTokensResponse> => {
  const tokens = body as RefreshTokensResponse | null;
  return typeof tokens?.accessToken === 'string' && typeof tokens.refreshToken === 'string';
};

/**
 * Sends `POST /auth/refresh` and reads its new tokens.
 *
 * @param environment - Where to send it.
 * @param refreshToken - The token to exchange.
 * @param correlationId - Ties the refresh to the request that needed it.
 * @returns The new tokens, `'ended'` on a 401, or `'failed'` on anything else.
 */
const exchange = async (
  environment: RefresherEnvironment,
  refreshToken: string,
  correlationId: string,
): Promise<Required<RefreshTokensResponse> | Exclude<RefreshOutcome, 'refreshed'>> => {
  const body: RefreshTokensData['body'] = { refreshToken };
  try {
    const response = await environment.fetchFn(`${environment.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [CORRELATION_HEADER]: correlationId },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return 'ended';
    const tokens: unknown = response.ok ? await response.json() : undefined;
    return isTokenPair(tokens) ? tokens : 'failed';
  } catch {
    return 'failed';
  }
};

/**
 * Refreshes once while holding the lock: reads the current refresh token,
 * exchanges it and keeps (or, when rejected, forgets) the result.
 *
 * @param environment - Tokens and transport.
 * @param correlationId - Ties the refresh to the request that needed it.
 * @returns How the refresh ended.
 */
const refreshOnce = async (
  environment: RefresherEnvironment,
  correlationId: string,
): Promise<RefreshOutcome> => {
  const refreshToken = environment.tokens.refreshToken();
  const result = refreshToken ? await exchange(environment, refreshToken, correlationId) : 'ended';

  if (result === 'ended') {
    environment.tokens.clear();
    log.info('Session ended: no valid refresh token', { correlationId });
    return 'ended';
  }
  if (result === 'failed') {
    log.warn('Token refresh got no answer', { correlationId });
    return 'failed';
  }
  environment.tokens.save(result);
  return 'refreshed';
};

/**
 * Builds the refresher: one exchange at a time in this tab, under the
 * cross-tab lock.
 *
 * @param environment - Tokens, transport and lock.
 * @returns The refresher.
 */
export const createRefresher = (environment: RefresherEnvironment): Refresher => {
  let inFlight: Promise<RefreshOutcome> | undefined;

  return (correlationId) => {
    inFlight ??= environment.lock(() => refreshOnce(environment, correlationId))
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };
};

/**
 * Builds the lock over the browser's Web Locks API. A browser without it
 * (none we support) runs the task unlocked: only this tab is coordinated.
 *
 * @param locks - `navigator.locks`, when the browser has it.
 * @returns The lock.
 */
export const browserRefreshLock = (locks: LockManager | undefined): RefreshLock => (
  (task) => (locks ? locks.request(api.refreshLockName, task) : task())
);
