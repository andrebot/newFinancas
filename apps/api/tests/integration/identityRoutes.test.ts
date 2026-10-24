import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished, vi,
} from 'vitest';
import { tooManyAttempts } from '../../src/managers/identity/errors';
import { appWithMocks, errorOf } from '../support/app';

const USER_ID = '0199c5a0-0000-7000-8000-000000000001';
const SESSION_ID = '0199c5a0-0000-7000-8000-0000000000aa';
const CORRELATION_ID = '0199c5a0-0000-7000-8000-0000000000cc';
const ACTOR = { userId: USER_ID, sessionId: SESSION_ID, systemRole: 'USER' as const };
const NOW = new Date('2026-10-13T12:00:00Z');
const SIGNED_IN = { token: 'good-token' };

/**
 * The app with a token check that accepts only `good-token`.
 *
 * @returns The app and its mocked Manager.
 */
const setup = () => appWithMocks(vi.fn(async (token: string) => (
  token === 'good-token' ? ACTOR : undefined
)));

type App = ReturnType<typeof setup>['app'];
interface SendOptions {
  readonly body?: unknown;
  readonly token?: string;
  readonly headers?: Record<string, string>;
}

/**
 * Sends a JSON request under /api/v1.
 *
 * @param app - The app.
 * @param method - HTTP method.
 * @param path - Path under /api/v1.
 * @param options - Body, token and extra headers.
 * @returns The response.
 */
const send = (app: App, method: string, path: string, options: SendOptions = {}) => {
  const auth = options.token ? { Authorization: `Bearer ${options.token}` } : {};
  return app.request(`/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth, ...options.headers },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
};

const REGISTRATION = {
  email: 'ana@example.com', password: 'short', firstName: 'Ana', lastName: 'Lima',
};
const CREDENTIALS = { email: 'ana@example.com', password: 'p' };
const VERIFICATION = { challengeToken: 'challenge', mfaCode: '123456' };

describe('identity routes — public', () => {
  it('POST /auth/register → 201; the Manager judges password length', async () => {
    const { app, identity } = setup();
    const registered = {
      userId: USER_ID,
      enrollmentToken: 'enrollment',
      totpSecret: 'S',
      otpauthUri: 'otpauth://totp/x',
      recoveryCodes: ['C'],
    };
    identity.register.mockResolvedValueOnce(registered);

    const response = await send(app, 'POST', '/auth/register', { body: REGISTRATION });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(registered);
    expect(identity.register)
      .toHaveBeenCalledWith({ correlationId: expect.any(String) }, REGISTRATION);
  });

  it('rejects a malformed body with 422 validation.failed before the Manager', async () => {
    const { app, identity } = setup();

    const response = await send(app, 'POST', '/auth/register', { body: { email: 'nope' } });

    expect(response.status).toBe(422);
    expect((await errorOf(response)).code).toBe('validation.failed');
    expect(identity.register).not.toHaveBeenCalled();
  });

  it('POST /auth/login answers the MFA challenge (OQ-145)', async () => {
    const { app, identity } = setup();
    identity.login.mockResolvedValueOnce({ step: 'mfa', challengeToken: 'challenge' });

    const response = await send(app, 'POST', '/auth/login', { body: CREDENTIALS });

    expect(await response.json()).toEqual({ step: 'mfa', challengeToken: 'challenge' });
    expect(identity.login).toHaveBeenCalledWith(expect.anything(), CREDENTIALS);
  });

  it('POST /auth/mfa/enrollment/confirm passes the device, returns tokens (OQ-149)', async () => {
    const { app, identity } = setup();
    identity.confirmMfaEnrollment.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const body = { enrollmentToken: 'enrollment', mfaCode: '123456' };

    const response = await send(app, 'POST', '/auth/mfa/enrollment/confirm', {
      body, headers: { 'User-Agent': 'Firefox' },
    });
    await send(app, 'POST', '/auth/mfa/enrollment/confirm', { body });

    expect(await response.json()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(identity.confirmMfaEnrollment)
      .toHaveBeenNthCalledWith(1, expect.anything(), body, 'Firefox');
    expect(identity.confirmMfaEnrollment).toHaveBeenNthCalledWith(2, expect.anything(), body, null);
  });

  it('rejects a confirmation without its code before the Manager', async () => {
    const { app, identity } = setup();

    const response = await send(app, 'POST', '/auth/mfa/enrollment/confirm', {
      body: { enrollmentToken: 'enrollment' },
    });

    expect(response.status).toBe(422);
    expect(identity.confirmMfaEnrollment).not.toHaveBeenCalled();
  });

  it('POST /auth/mfa/verify passes the device (User-Agent), or null without one', async () => {
    const { app, identity } = setup();
    identity.verifyMfa.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const ok = await send(app, 'POST', '/auth/mfa/verify', {
      body: VERIFICATION, headers: { 'User-Agent': 'Firefox' },
    });
    await send(app, 'POST', '/auth/mfa/verify', { body: VERIFICATION });

    expect(await ok.json()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(identity.verifyMfa)
      .toHaveBeenNthCalledWith(1, expect.anything(), VERIFICATION, 'Firefox');
    expect(identity.verifyMfa).toHaveBeenNthCalledWith(2, expect.anything(), VERIFICATION, null);
  });

  it('a lockout answers 429 with Retry-After and the wait in minutes', async () => {
    const { app, identity } = setup();
    identity.login.mockRejectedValueOnce(tooManyAttempts(new Date(NOW.getTime() + 600_000), NOW));

    const response = await send(app, 'POST', '/auth/login', { body: CREDENTIALS });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('600');
    expect(await errorOf(response))
      .toMatchObject({ code: 'auth.too_many_attempts', params: { retryAfterMinutes: 10 } });
  });

  it('POST /auth/refresh exchanges the token', async () => {
    const { app, identity } = setup();
    identity.refresh.mockResolvedValueOnce({ accessToken: 'a2', refreshToken: 'r2' });

    const response = await send(app, 'POST', '/auth/refresh', { body: { refreshToken: 'r' } });

    expect(await response.json()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(identity.refresh).toHaveBeenCalledWith(expect.anything(), 'r');
  });
});

describe('identity routes — passwords and recovery (OQ-115)', () => {
  it('POST /auth/mfa/recover passes the device and returns tokens', async () => {
    const { app, identity } = setup();
    identity.recoverWithCode.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const body = { challengeToken: 'challenge', recoveryCode: 'ABCD-EFGH' };

    const response = await send(app, 'POST', '/auth/mfa/recover', {
      body, headers: { 'User-Agent': 'Phone' },
    });
    await send(app, 'POST', '/auth/mfa/recover', { body });

    expect(await response.json()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(identity.recoverWithCode).toHaveBeenNthCalledWith(1, expect.anything(), body, 'Phone');
    expect(identity.recoverWithCode).toHaveBeenNthCalledWith(2, expect.anything(), body, null);
  });

  it('POST /auth/password-reset/request → 202 whatever the address', async () => {
    const { app, identity } = setup();
    identity.requestPasswordReset.mockResolvedValueOnce(undefined);

    const response = await send(app, 'POST', '/auth/password-reset/request', {
      body: { email: 'ana@example.com' },
    });

    expect(response.status).toBe(202);
    expect(identity.requestPasswordReset)
      .toHaveBeenCalledWith(expect.anything(), 'ana@example.com');
  });

  it('POST /auth/password-reset/confirm → 200; length is the Manager\'s call', async () => {
    const { app, identity } = setup();
    const body = { token: 't', newPassword: 'short' };

    const response = await send(app, 'POST', '/auth/password-reset/confirm', { body });

    expect(response.status).toBe(200);
    expect(identity.confirmPasswordReset).toHaveBeenCalledWith(expect.anything(), body);
  });

  it('POST /auth/change-password → 200 when signed in, 401 otherwise', async () => {
    const { app, identity } = setup();
    const body = { currentPassword: 'old', newPassword: 'short' };

    const signedOut = await send(app, 'POST', '/auth/change-password', { body });
    const changed = await send(app, 'POST', '/auth/change-password', { body, ...SIGNED_IN });

    expect(signedOut.status).toBe(401);
    expect(changed.status).toBe(200);
    expect(identity.changePassword)
      .toHaveBeenCalledWith(expect.objectContaining({ actor: ACTOR }), body);
  });
});

describe('identity routes — profile and lists (OQ-116)', () => {
  const USER = {
    id: USER_ID,
    email: 'ana@example.com',
    firstName: 'Ana',
    lastName: 'Lima',
    theme: 'dark' as const,
    language: 'pt-BR' as const,
    systemRole: 'USER' as const,
    createdAt: NOW,
  };
  const USER_JSON = {
    id: USER_ID,
    email: 'ana@example.com',
    firstName: 'Ana',
    lastName: 'Lima',
    createdAt: NOW.toISOString(),
    preferences: { theme: 'dark', language: 'pt-BR' },
  };

  it('GET /users/me shows the profile without the system role', async () => {
    const { app, identity } = setup();
    identity.getProfile.mockResolvedValueOnce(USER);

    const response = await send(app, 'GET', '/users/me', SIGNED_IN);

    expect(await response.json()).toEqual(USER_JSON);
  });

  it('PATCH /users/me passes names as sent, never fills in a preference', async () => {
    const { app, identity } = setup();
    identity.editProfile.mockResolvedValueOnce(USER);

    const edited = await send(app, 'PATCH', '/users/me', {
      ...SIGNED_IN, body: { firstName: ' Ana ', preferences: { language: 'en-US' } },
    });

    expect(await edited.json()).toEqual(USER_JSON);
    expect(identity.editProfile).toHaveBeenCalledWith(
      expect.objectContaining({ actor: ACTOR }),
      { firstName: ' Ana ', preferences: { language: 'en-US' } },
    );
  });

  it('PATCH /users/me refuses an empty name against the contract', async () => {
    const { app, identity } = setup();

    const empty = await send(app, 'PATCH', '/users/me', { ...SIGNED_IN, body: { lastName: '' } });

    expect(empty.status).toBe(422);
    expect(identity.editProfile).not.toHaveBeenCalled();
  });

  it('POST /auth/register passes the registering locale on (OQ-161)', async () => {
    const { app, identity } = setup();

    await send(app, 'POST', '/auth/register', { body: { ...REGISTRATION, language: 'en-US' } });

    expect(identity.register)
      .toHaveBeenCalledWith(expect.anything(), { ...REGISTRATION, language: 'en-US' });
  });

  it('POST /auth/register refuses an unsupported language', async () => {
    const { app, identity } = setup();

    const response = await send(app, 'POST', '/auth/register', {
      body: { ...REGISTRATION, language: 'fr-FR' },
    });

    expect(response.status).toBe(422);
    expect(identity.register).not.toHaveBeenCalled();
  });

  it('POST /auth/register refuses an empty name against the contract', async () => {
    const { app, identity } = setup();

    const response = await send(app, 'POST', '/auth/register', {
      body: { ...REGISTRATION, firstName: '' },
    });

    expect(response.status).toBe(422);
    expect(identity.register).not.toHaveBeenCalled();
  });

  it('GET /households lists my households with my role', async () => {
    const { app, identity } = setup();
    identity.listMyHouseholds.mockResolvedValueOnce([{
      id: 'h1', name: 'Casa', createdAt: NOW, role: 'Owner',
    }]);

    const response = await send(app, 'GET', '/households', SIGNED_IN);

    expect(await response.json()).toEqual({
      data: [{
        id: 'h1', name: 'Casa', createdAt: NOW.toISOString(), role: 'Owner',
      }],
    });
  });

  it('GET /users/me/invitations lists them with the names to show', async () => {
    const { app, identity } = setup();
    const invitation = {
      id: 'i1',
      householdId: 'h1',
      householdName: 'Casa',
      role: 'Member' as const,
      invitedByUserId: 'u2',
      inviterFirstName: 'Ben',
      inviterLastName: 'Demo',
      createdAt: NOW,
    };
    identity.listMyInvitations.mockResolvedValueOnce([invitation]);

    const response = await send(app, 'GET', '/users/me/invitations', SIGNED_IN);

    expect(await response.json())
      .toEqual({ data: [{ ...invitation, createdAt: NOW.toISOString() }] });
  });
});

describe('identity routes — signed in', () => {
  const NO_GOOD_TOKEN: SendOptions[] = [{}, { token: 'stolen-token' }];

  it.each(NO_GOOD_TOKEN)('answer 401 auth.unauthenticated (%j)', async (auth) => {
    const { app, identity } = setup();

    const response = await send(app, 'POST', '/auth/logout', auth);

    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe('auth.unauthenticated');
    expect(identity.logout).not.toHaveBeenCalled();
  });

  it('POST /auth/logout → 204 with actor and correlation ID; logs name the user', async () => {
    const { app, identity } = setup();
    const logs = captureLogs(onTestFinished);

    const response = await send(app, 'POST', '/auth/logout', {
      ...SIGNED_IN, headers: { 'X-Correlation-Id': CORRELATION_ID },
    });

    expect(response.status).toBe(204);
    expect(identity.logout).toHaveBeenCalledWith({ correlationId: CORRELATION_ID, actor: ACTOR });
    expect(logs.events)
      .toContainEqual(expect.objectContaining({ label: 'http', actor: `user:${USER_ID}` }));
  });

  it('GET /users/me/sessions lists them with ISO times', async () => {
    const { app, identity } = setup();
    identity.listSessions.mockResolvedValueOnce([{
      id: SESSION_ID, deviceInfo: null, createdAt: NOW, lastUsedAt: NOW, current: true,
    }]);

    const response = await send(app, 'GET', '/users/me/sessions', SIGNED_IN);

    const iso = NOW.toISOString();
    expect(await response.json()).toEqual({
      data: [{
        id: SESSION_ID, deviceInfo: null, createdAt: iso, lastUsedAt: iso, current: true,
      }],
    });
  });

  it('DELETE /users/me/sessions signs out the others', async () => {
    const { app, identity } = setup();

    expect((await send(app, 'DELETE', '/users/me/sessions', SIGNED_IN)).status).toBe(204);
    expect(identity.revokeOtherSessions).toHaveBeenCalled();
  });

  it('DELETE /users/me/sessions/:sessionId revokes one, uuids only', async () => {
    const { app, identity } = setup();

    const revoked = await send(app, 'DELETE', `/users/me/sessions/${SESSION_ID}`, SIGNED_IN);
    const malformed = await send(app, 'DELETE', '/users/me/sessions/not-a-uuid', SIGNED_IN);

    expect(revoked.status).toBe(204);
    expect(identity.revokeSession)
      .toHaveBeenCalledWith(expect.objectContaining({ actor: ACTOR }), SESSION_ID);
    expect(malformed.status).toBe(422);
  });
});
