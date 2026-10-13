import type { AuthTokens } from '@financas/api-types';
import type { ClearableStorage } from '../utilities/safeStorage';

// The session's tokens (FU7, OQ-124). The access token lives in this tab's
// memory only — the contract never persists it. The refresh token lives in
// browser storage, shared by every tab, so a reload or a new tab stays signed
// in; it is read from storage on every use, because another tab may have
// rotated it since.

/** Holds the tokens of the signed-in session. */
export interface TokenStore {
  /** This tab's access token, if it has one. */
  readonly accessToken: () => string | undefined;
  /** The session's current refresh token, if signed in. */
  readonly refreshToken: () => string | undefined;
  /** Keeps a new token pair (sign-in, refresh). */
  readonly save: (tokens: Required<AuthTokens>) => void;
  /** Forgets both tokens (sign-out, session ended). */
  readonly clear: () => void;
}

/**
 * Builds the token store over the refresh token's storage entry.
 *
 * @param storage - The never-throwing entry holding the refresh token.
 * @returns The store; it starts with no access token.
 */
export const createTokenStore = (storage: ClearableStorage): TokenStore => {
  let accessToken: string | undefined;

  return {
    accessToken: () => accessToken,
    refreshToken: () => storage.read() || undefined,
    save: (tokens) => {
      accessToken = tokens.accessToken;
      storage.write(tokens.refreshToken);
    },
    clear: () => {
      accessToken = undefined;
      storage.remove();
    },
  };
};
