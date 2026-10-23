import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import type {
  AuthTokens, HouseholdMembership, Invitation, MfaEnrollmentStart, MyHousehold,
  ReceivedInvitation, User,
} from '@financas/api-types';
import totpCode from './totp';

// Arranging through the API (I7): a journey's preconditions — another user, a
// household, a membership — are created by calling the backend directly, so
// only the behaviour under test goes through the browser.

export const API_URL = 'http://localhost:3000/api/v1';

/** A household role an invitation can grant. */
export type InvitedRole = 'Admin' | 'Member' | 'Viewer';

/** A registered user with confirmed MFA, and what a test needs to act as them. */
export interface TestUser {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly totpSecret: string;
  readonly recoveryCodes: readonly string[];
  readonly accessToken: string;
}

/** The name a test user starts with. */
export interface TestUserName {
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * A new user's credentials, unique per call so journeys never collide (and
 * never share a login-lockout bucket).
 *
 * @param name - The user's first and last name.
 * @returns Email, password and name.
 */
export const newCredentials = (name: TestUserName) => ({
  ...name,
  email: `${name.firstName.toLowerCase()}.${randomUUID()}@e2e.financas.local`,
  password: `Pw-${randomUUID()}`,
});

/**
 * Sends a JSON request and returns the parsed body, failing the test on any
 * non-2xx status.
 *
 * @param request - Playwright's API client.
 * @param method - The HTTP method.
 * @param path - The path under `/api/v1`.
 * @param options - The JSON body and the access token, when needed.
 * @returns The response body (`undefined` for an empty one).
 */
const send = async <Body>(
  request: APIRequestContext,
  method: string,
  path: string,
  options: { readonly data?: object; readonly accessToken?: string } = {},
): Promise<Body> => {
  const response = await request.fetch(`${API_URL}${path}`, {
    method,
    data: options.data,
    headers: options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {},
  });
  if (!response.ok()) {
    throw new Error(`${method} ${path} → ${response.status()}: ${await response.text()}`);
  }
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as Body;
};

/**
 * Registers a user and confirms their MFA enrollment, as Onboard would.
 *
 * @param request - Playwright's API client.
 * @param name - The user's first and last name.
 * @returns The signed-in user.
 */
export const registerUser = async (
  request: APIRequestContext,
  name: TestUserName,
): Promise<TestUser> => {
  const credentials = newCredentials(name);
  // In the locale the journeys run in, as Onboard would send it (OQ-161).
  const enrollment = await send<MfaEnrollmentStart>(request, 'POST', '/auth/register', {
    data: { ...credentials, language: 'en-US' },
  });
  const tokens = await send<AuthTokens>(request, 'POST', '/auth/mfa/enrollment/confirm', {
    data: {
      enrollmentToken: enrollment.enrollmentToken,
      mfaCode: await totpCode(enrollment.totpSecret),
    },
  });
  // Fail here, where it broke, rather than at the first call that needs the token.
  if (!tokens.accessToken) {
    throw new Error(`Enrollment for ${credentials.email} returned no access token`);
  }
  return {
    ...credentials,
    totpSecret: enrollment.totpSecret,
    recoveryCodes: enrollment.recoveryCodes,
    accessToken: tokens.accessToken,
  };
};

/**
 * Signs a user in through the API, both steps, as Sign In would.
 *
 * @param request - Playwright's API client.
 * @param user - The user who signs in.
 * @returns The new session's tokens.
 */
export const signInThroughApi = async (
  request: APIRequestContext,
  user: Pick<TestUser, 'email' | 'password' | 'totpSecret'>,
): Promise<AuthTokens> => {
  const challenge = await send<{ step: string; challengeToken: string }>(
    request,
    'POST',
    '/auth/login',
    { data: { email: user.email, password: user.password } },
  );
  return send<AuthTokens>(request, 'POST', '/auth/mfa/verify', {
    data: { challengeToken: challenge.challengeToken, mfaCode: await totpCode(user.totpSecret) },
  });
};

/** The backup codes each user (by email) has used up in this run. */
const usedRecoveryCodes = new Map<string, number>();

/**
 * Signs a user in through the API with a backup code instead of an
 * authenticator code — another device's session that doesn't use up a TOTP
 * step (codes work once, OQ-163). Each call takes the user's next unused code.
 *
 * @param request - Playwright's API client.
 * @param user - The user who signs in.
 * @returns The new session's tokens.
 */
export const signInWithRecoveryCode = async (
  request: APIRequestContext,
  user: TestUser,
): Promise<AuthTokens> => {
  const used = usedRecoveryCodes.get(user.email) ?? 0;
  const recoveryCode = user.recoveryCodes[used];
  if (!recoveryCode) throw new Error(`${user.email} has no backup code left`);
  usedRecoveryCodes.set(user.email, used + 1);
  const challenge = await send<{ step: string; challengeToken: string }>(
    request,
    'POST',
    '/auth/login',
    { data: { email: user.email, password: user.password } },
  );
  return send<AuthTokens>(request, 'POST', '/auth/mfa/recover', {
    data: { challengeToken: challenge.challengeToken, recoveryCode },
  });
};

/**
 * Tries to exchange a refresh token, without failing the test on a refusal.
 *
 * @param request - Playwright's API client.
 * @param refreshToken - The token to present.
 * @returns The HTTP status the API answered.
 */
export const refreshStatus = async (
  request: APIRequestContext,
  refreshToken: string,
): Promise<number> => (
  (await request.post(`${API_URL}/auth/refresh`, { data: { refreshToken } })).status()
);

/**
 * Reads the signed-in user's own account.
 *
 * @param request - Playwright's API client.
 * @param accessToken - The user's access token.
 * @returns The account, preferences included.
 */
export const currentUser = (
  request: APIRequestContext,
  accessToken: string,
): Promise<User> => send(request, 'GET', '/users/me', { accessToken });

/**
 * Lists the invitations waiting for a user's answer.
 *
 * @param request - Playwright's API client.
 * @param user - The invitee.
 * @returns Their pending invitations.
 */
export const pendingInvitations = async (
  request: APIRequestContext,
  user: TestUser,
): Promise<readonly ReceivedInvitation[]> => {
  const received = await send<{ data?: ReceivedInvitation[] }>(
    request,
    'GET',
    '/users/me/invitations',
    { accessToken: user.accessToken },
  );
  return received.data ?? [];
};

/**
 * Lists the households a user belongs to.
 *
 * @param request - Playwright's API client.
 * @param user - The member.
 * @returns Their households.
 */
export const listHouseholds = async (
  request: APIRequestContext,
  user: TestUser,
): Promise<readonly MyHousehold[]> => {
  const households = await send<{ data?: MyHousehold[] }>(request, 'GET', '/households', {
    accessToken: user.accessToken,
  });
  return households.data ?? [];
};

/**
 * Creates a household owned by the user, set up as Guided Setup leaves it:
 * with a first account, so its pages open inside the chrome rather than in
 * Guided Setup (FR-1.22, OQ-198).
 *
 * @param request - Playwright's API client.
 * @param owner - The user who creates it.
 * @param name - The household's name.
 * @returns The new household.
 */
export const createHousehold = async (
  request: APIRequestContext,
  owner: TestUser,
  name: string,
): Promise<MyHousehold> => {
  const household = await send<MyHousehold>(request, 'POST', '/households', {
    data: { name },
    accessToken: owner.accessToken,
  });
  await send(request, 'POST', `/households/${household.id}/accounts`, {
    data: {
      name: 'Main Checking', type: 'checking', currency: 'BRL', visibility: 'shared', cards: [],
    },
    accessToken: owner.accessToken,
  });
  return household;
};

/**
 * Invites a registered user into a household.
 *
 * @param request - Playwright's API client.
 * @param inviter - An Owner or Admin of the household.
 * @param householdId - The household.
 * @param invitee - Who is invited, and with which role.
 * @returns The invitation.
 */
export const inviteUser = (
  request: APIRequestContext,
  inviter: TestUser,
  householdId: string,
  invitee: { readonly email: string; readonly role: InvitedRole },
): Promise<Invitation> => send(request, 'POST', `/households/${householdId}/invitations`, {
  data: invitee,
  accessToken: inviter.accessToken,
});

/**
 * Adds a user to a household: invited by the Owner, then accepted.
 *
 * @param request - Playwright's API client.
 * @param owner - The household's Owner (or an Admin).
 * @param householdId - The household.
 * @param member - The user who joins, and their role.
 * @returns Resolves once the user is a member.
 */
export const addMember = async (
  request: APIRequestContext,
  owner: TestUser,
  householdId: string,
  member: { readonly user: TestUser; readonly role: InvitedRole },
): Promise<void> => {
  await inviteUser(request, owner, householdId, { email: member.user.email, role: member.role });
  const received = await send<{ data?: ReceivedInvitation[] }>(
    request,
    'GET',
    '/users/me/invitations',
    { accessToken: member.user.accessToken },
  );
  const invitation = received.data?.find((pending) => pending.householdId === householdId);
  if (!invitation) throw new Error(`No invitation to ${householdId} for ${member.user.email}`);
  await send(request, 'POST', `/invitations/${invitation.id}/accept`, {
    accessToken: member.user.accessToken,
  });
};

/**
 * Lists a household's members, as one of them sees it.
 *
 * @param request - Playwright's API client.
 * @param viewer - A member of the household.
 * @param householdId - The household.
 * @returns Its members, with their roles.
 */
export const listMembers = async (
  request: APIRequestContext,
  viewer: TestUser,
  householdId: string,
): Promise<readonly HouseholdMembership[]> => {
  const members = await send<{ data?: HouseholdMembership[] }>(
    request,
    'GET',
    `/households/${householdId}/members`,
    { accessToken: viewer.accessToken },
  );
  return members.data ?? [];
};
