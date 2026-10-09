import { describe, expect, it } from 'vitest';
import { authentication } from '../../../../src/config/constants';
import {
  currentTotp, enrollMfa, hashRecoveryCode, newRecoveryCode, normalizeRecoveryCode,
  toCrockford, verifyRecoveryCode, verifyTotp,
} from '../../../../src/utilities/authentication/mfa';

// RFC 6238, Appendix B: SHA-1 secret "12345678901234567890" at T = 59 s → 94287082 (8 digits).
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const AT_59S = new Date(59_000);

/**
 * Deterministic randomness: each call returns bytes counting up from a seed.
 *
 * @returns A `randomBytes` stand-in.
 */
const countingBytes = () => {
  let seed = 0;
  return (size: number) => Buffer.from(Array.from({ length: size }, () => {
    seed += 1;
    return seed % 256;
  }));
};

describe('verifyTotp / currentTotp (RFC 6238)', () => {
  it('matches the RFC test vector', () => {
    expect(currentTotp(RFC_SECRET, AT_59S)).toBe('287082');
    expect(verifyTotp(RFC_SECRET, '287082', AT_59S)).toBe(true);
  });

  it('allows one 30-second step of drift either way, not two', () => {
    const code = currentTotp(RFC_SECRET, AT_59S);

    expect(verifyTotp(RFC_SECRET, code, new Date(59_000 + 30_000))).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, new Date(59_000 - 30_000))).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, new Date(59_000 + 60_000))).toBe(false);
  });

  it.each(['', '28708', '2870820', 'abcdef', '000000'])('rejects %j', (code) => {
    expect(verifyTotp(RFC_SECRET, code, AT_59S)).toBe(false);
  });
});

describe('recovery codes', () => {
  it('encodes Crockford base32 without I, L, O or U', () => {
    expect(toCrockford(Buffer.from([0, 0, 0, 0, 0]))).toBe('00000000');
    expect(toCrockford(Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff]))).toBe('ZZZZZZZZ');
  });

  it('makes 16-character codes in groups of four (80 bits)', () => {
    const group = '[0-9A-HJKMNP-TV-Z]{4}';

    expect(newRecoveryCode(countingBytes())).toMatch(new RegExp(`^${group}(-${group}){3}$`));
  });

  it('normalises how a code is typed', () => {
    expect(normalizeRecoveryCode(' 7kqm-2xwr 9ptd-4hnc ')).toBe('7KQM2XWR9PTD4HNC');
    expect(normalizeRecoveryCode('O0IL')).toBe('0011');
  });

  it('verifies a code against its hash however it is typed, in constant time', () => {
    const stored = hashRecoveryCode('7KQM-2XWR-9PTD-4HNC');

    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyRecoveryCode('7kqm 2xwr 9ptd 4hnc', stored)).toBe(true);
    expect(verifyRecoveryCode('7KQM-2XWR-9PTD-4HND', stored)).toBe(false);
    expect(verifyRecoveryCode('7KQM-2XWR-9PTD-4HNC', 'abcd')).toBe(false);
  });
});

describe('enrollMfa', () => {
  it('returns a secret, an otpauth URI, and 10 distinct codes with their hashes', () => {
    const enrolment = enrollMfa('ana@example.com', countingBytes());

    expect(enrolment.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(enrolment.otpauthUri).toMatch(/^otpauth:\/\/totp\/Finance%20APP:ana%40example\.com\?/);
    expect(enrolment.otpauthUri).toContain(`secret=${enrolment.secret}`);
    expect(enrolment.recoveryCodes).toHaveLength(authentication.recoveryCodes.count);
    expect(new Set(enrolment.recoveryCodes).size).toBe(authentication.recoveryCodes.count);
    expect(enrolment.recoveryCodeHashes).toEqual(enrolment.recoveryCodes.map(hashRecoveryCode));
  });

  it('enrols a secret that the authenticator codes verify against', () => {
    const { secret } = enrollMfa('ana@example.com', countingBytes());
    const now = new Date('2026-10-08T12:00:00Z');

    expect(verifyTotp(secret, currentTotp(secret, now), now)).toBe(true);
  });
});
