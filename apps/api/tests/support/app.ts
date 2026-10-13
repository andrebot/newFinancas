import { vi, type Mock } from 'vitest';
import createApp from '../../src/app';
import type { VerifyAccessToken } from '../../src/http/authentication';
import type { IdentityManager } from '../../src/managers/identity';

// The app with its Managers mocked — the one boundary below the routes (BDT).
// Every Manager use case is a `vi.fn()` the test programs.

export type MockedIdentity = { [K in keyof IdentityManager]: Mock<IdentityManager[K]> };

/**
 * An IdentityManager whose every use case is a mock.
 *
 * @returns The mock Manager.
 */
export const mockIdentity = (): MockedIdentity => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  recoverWithCode: vi.fn(),
  changePassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  getProfile: vi.fn(),
  editProfile: vi.fn(),
  listMyHouseholds: vi.fn(),
  listMyInvitations: vi.fn(),
});

/**
 * Builds the app over mocked Managers and a programmable token check.
 *
 * @param verifyAccessToken - Token verification (default: every token is invalid).
 * @returns The app and its mocks.
 */
export const appWithMocks = (
  verifyAccessToken: VerifyAccessToken = vi.fn(async () => undefined),
) => {
  const identity = mockIdentity();
  return { app: createApp({ identity, verifyAccessToken }), identity };
};

/**
 * The error envelope of a response.
 *
 * @param response - A failed response.
 * @returns Its `error` object.
 */
export const errorOf = async (response: Response) => (
  (await response.json() as { error: { code: string; params?: Record<string, unknown> } }).error
);
