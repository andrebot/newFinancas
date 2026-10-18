import { vi, type Mock } from 'vitest';
import createApp from '../../src/app';
import type { VerifyAccessToken } from '../../src/http/authentication';
import type { AccountManager } from '../../src/managers/account';
import type { IdentityManager } from '../../src/managers/identity';

// The app with its Managers mocked — the one boundary below the routes (BDT).
// Every Manager use case is a `vi.fn()` the test programs.

export type MockedIdentity = { [K in keyof IdentityManager]: Mock<IdentityManager[K]> };
export type MockedAccount = { [K in keyof AccountManager]: Mock<AccountManager[K]> };

/**
 * An IdentityManager whose every use case is a mock.
 *
 * @returns The mock Manager.
 */
export const mockIdentity = (): MockedIdentity => ({
  register: vi.fn(),
  login: vi.fn(),
  verifyMfa: vi.fn(),
  confirmMfaEnrollment: vi.fn(),
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
  createHousehold: vi.fn(),
  getHousehold: vi.fn(),
  deleteHousehold: vi.fn(),
  listMembers: vi.fn(),
  removeMember: vi.fn(),
  changeMemberRole: vi.fn(),
  transferOwnership: vi.fn(),
  inviteUser: vi.fn(),
  listHouseholdInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
});

/**
 * An AccountManager whose every use case is a mock.
 *
 * @returns The mock Manager.
 */
export const mockAccount = (): MockedAccount => ({
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  createCategory: vi.fn(),
  editCategory: vi.fn(),
  archiveCategory: vi.fn(),
  archiveSubcategory: vi.fn(),
  listAccounts: vi.fn(),
  getAccount: vi.fn(),
  createAccount: vi.fn(),
  editAccount: vi.fn(),
  archiveAccount: vi.fn(),
  getAccountBalances: vi.fn(),
  listBudgets: vi.fn(),
  getBudget: vi.fn(),
  createBudget: vi.fn(),
  editBudget: vi.fn(),
  deleteBudget: vi.fn(),
  listBudgetPeriods: vi.fn(),
  listGoals: vi.fn(),
  getGoal: vi.fn(),
  createGoal: vi.fn(),
  editGoal: vi.fn(),
  completeGoal: vi.fn(),
  reopenGoal: vi.fn(),
  deleteGoal: vi.fn(),
  listHoldingAllocations: vi.fn(),
  editHolding: vi.fn(),
  archiveHolding: vi.fn(),
  listScheduleEntries: vi.fn(),
  listValuationSnapshots: vi.fn(),
  recordMarketValue: vi.fn(),
  editMarketValue: vi.fn(),
  deleteMarketValue: vi.fn(),
  listIndexRates: vi.fn(),
  recordIndexRate: vi.fn(),
  editIndexRate: vi.fn(),
  deleteIndexRate: vi.fn(),
  getCreditCardBalances: vi.fn(),
  seedDefaultCategories: vi.fn(),
  notifyMaturedHolding: vi.fn(),
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
  const account = mockAccount();
  return { app: createApp({ identity, account, verifyAccessToken }), identity, account };
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
