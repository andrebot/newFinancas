import { captureLogs } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import { ANA, fakeDeps } from './fakes';

const CONTEXT = { correlationId: 'c1' };
const INPUT = {
  email: '  ana@example.com ',
  password: 'correct horse battery',
  firstName: ' Ana ',
  lastName: 'Lima ',
};

describe('IdentityManager — Register (uc-11)', () => {
  it('stores hashes and the sealed secret, returns the secret and codes once, audits', async () => {
    const { deps, users, authentication } = fakeDeps();
    const logs = captureLogs();

    const registered = await createIdentityManager(deps).register(CONTEXT, INPUT);
    logs.stop();

    expect(users.insert).toHaveBeenCalledWith({
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Lima',
      passwordHash: 'hash(correct horse battery)',
      encryptedMfaSecret: 'sealed-new',
      recoveryCodeHashes: ['h1', 'h2'],
    });
    expect(registered).toEqual({
      userId: ANA.id,
      enrollmentToken: 'enrollment-token',
      totpSecret: 'TOTPSECRET',
      otpauthUri: 'otpauth://totp/x',
      recoveryCodes: ['CODE1', 'CODE2'],
    });
    expect(authentication.signEnrollmentToken)
      .toHaveBeenCalledWith({ userId: ANA.id, email: ANA.email });
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'audit',
      message: 'CreateUser',
      entityType: 'User',
      entityId: ANA.id,
      actor: `user:${ANA.id}`,
    }));
  });

  it('rejects a password under 12 characters before doing any work', async () => {
    const { deps, users, authentication } = fakeDeps();

    await expect(createIdentityManager(deps).register(CONTEXT, { ...INPUT, password: 'short' }))
      .rejects.toMatchObject({
        apiError: { status: 422, code: 'password.too_short', params: { min: 12 } },
      });
    expect(authentication.hashPassword).not.toHaveBeenCalled();
    expect(users.insert).not.toHaveBeenCalled();
  });

  it('answers 409 user.email_taken for a registered email', async () => {
    const { deps, users } = fakeDeps();
    users.insert.mockResolvedValueOnce({ ok: false, reason: 'email_taken' } as never);

    await expect(createIdentityManager(deps).register(CONTEXT, INPUT))
      .rejects.toMatchObject({ apiError: { status: 409, code: 'user.email_taken' } });
  });
});
