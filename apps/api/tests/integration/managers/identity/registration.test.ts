import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createIdentityManager } from '../../../../src/managers/identity';
import { ANA, blankName, fakeDeps } from './fakes';

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
    const logs = captureLogs(onTestFinished);

    const registered = await createIdentityManager(deps).register(CONTEXT, INPUT);

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

  it('starts the account in the locale the user registered in (OQ-161)', async () => {
    const { deps, users } = fakeDeps();

    await createIdentityManager(deps).register(CONTEXT, { ...INPUT, language: 'en-US' });

    expect(users.insert).toHaveBeenCalledWith(expect.objectContaining({ language: 'en-US' }));
  });

  it('refuses a blank name with 422 validation.failed before doing any work (OQ-165)', async () => {
    const { deps, users, authentication } = fakeDeps();

    await expect(createIdentityManager(deps).register(CONTEXT, { ...INPUT, firstName: ' ' }))
      .rejects.toMatchObject(blankName('firstName'));
    expect(authentication.hashPassword).not.toHaveBeenCalled();
    expect(users.insert).not.toHaveBeenCalled();
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

  it('accepts a password of exactly 12 characters, refuses 11', async () => {
    const { deps, users } = fakeDeps();
    const identity = createIdentityManager(deps);

    await expect(identity.register(CONTEXT, { ...INPUT, password: 'x'.repeat(11) }))
      .rejects.toMatchObject({ apiError: { code: 'password.too_short' } });
    await identity.register(CONTEXT, { ...INPUT, password: 'x'.repeat(12) });

    expect(users.insert).toHaveBeenCalledTimes(1);
  });

  it('answers 409 user.email_taken for a registered email', async () => {
    const { deps, users } = fakeDeps();
    users.insert.mockResolvedValueOnce({ ok: false, reason: 'email_taken' } as never);

    await expect(createIdentityManager(deps).register(CONTEXT, INPUT))
      .rejects.toMatchObject({ apiError: { status: 409, code: 'user.email_taken' } });
  });
});
