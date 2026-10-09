import { describe, expect, it } from 'vitest';
import {
  createAuthenticationUtility, REFRESH_TOKEN_TTL_DAYS,
} from '../../../../src/utilities/authentication';

const CONFIG = {
  jwtSecret: 'j'.repeat(32),
  mfaEncryptionKey: Buffer.alloc(32, 3).toString('base64'),
};
const NOW = new Date('2026-10-08T12:00:00Z');
let counter = 0;
const deps = {
  now: () => NOW,
  randomBytes: (size: number) => Buffer.from(Array.from({ length: size }, () => {
    counter += 1;
    return counter % 256;
  })),
};

describe('createAuthenticationUtility', () => {
  const auth = createAuthenticationUtility(CONFIG, deps);

  it('enrols MFA with the secret encrypted for storage, and verifies codes through it', () => {
    const enrolment = auth.enrollMfa('ana@example.com');

    expect(enrolment.encryptedSecret.startsWith('v1.')).toBe(true);
    expect(enrolment.encryptedSecret).not.toContain(enrolment.secret);
    const code = auth.currentTotp(enrolment.encryptedSecret);

    expect(auth.verifyTotp(enrolment.encryptedSecret, code)).toBe(true);
    expect(auth.verifyTotp(enrolment.encryptedSecret, '000000')).toBe(false);
  });

  it('throws when a stored secret cannot be decrypted (wrong key = configuration error)', () => {
    const otherKey = Buffer.alloc(32, 4).toString('base64');
    const other = createAuthenticationUtility({ ...CONFIG, mfaEncryptionKey: otherKey }, deps);
    const { encryptedSecret } = other.enrollMfa('ana@example.com');

    expect(() => auth.verifyTotp(encryptedSecret, '123456')).toThrow();
  });

  it('signs and verifies access tokens with the configured key and clock', async () => {
    expect(await auth.verifyAccessToken(await auth.signAccessToken('user-1'))).toBe('user-1');
  });

  it('issues opaque tokens and exposes the token policy', () => {
    const { token, tokenHash } = auth.issueOpaqueToken();

    expect(auth.hashOpaqueToken(token)).toBe(tokenHash);
    expect(REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  it('refuses an encryption key that is not 32 bytes', () => {
    expect(() => createAuthenticationUtility({ ...CONFIG, mfaEncryptionKey: 'c2hvcnQ=' }))
      .toThrow(/32 bytes/);
  });

  it('works with the real clock and randomness by default', async () => {
    const real = createAuthenticationUtility(CONFIG);

    expect(await real.verifyAccessToken(await real.signAccessToken('user-2'))).toBe('user-2');
    expect(real.issueOpaqueToken().token).not.toBe(real.issueOpaqueToken().token);
  });
});
