import { createHash, timingSafeEqual } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';

// MFA primitives (NFR-SEC-1, FR-1.14–1.16, OQ-100). TOTP is the first method,
// not the only one — this module is where another would be added.

/** Standard authenticator-app settings (RFC 6238). */
export const TOTP_SETTINGS = {
  algorithm: 'SHA1', digits: 6, period: 30, window: 1,
} as const;

const ISSUER = 'Finance APP';
export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 10; // 80 bits → 16 Crockford base32 characters
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Builds the TOTP for a secret.
 *
 * @param secretBase32 - The shared secret.
 * @param label - Account label shown in the authenticator app.
 * @returns The TOTP generator/validator.
 */
const totpFor = (secretBase32: string, label = '') => new TOTP({
  issuer: ISSUER,
  label,
  algorithm: TOTP_SETTINGS.algorithm,
  digits: TOTP_SETTINGS.digits,
  period: TOTP_SETTINGS.period,
  secret: Secret.fromBase32(secretBase32),
});

/**
 * Encodes bytes as Crockford base32 (no I, L, O, U — easy to read aloud and type).
 *
 * @param bytes - Bytes whose length is a multiple of 5.
 * @returns The encoded text.
 */
export const toCrockford = (bytes: Buffer): string => {
  const bits = [...bytes].map((byte) => byte.toString(2).padStart(8, '0')).join('');
  return Array.from(
    { length: bits.length / 5 },
    (_, index) => CROCKFORD[parseInt(bits.slice(index * 5, index * 5 + 5), 2)],
  ).join('');
};

/**
 * Generates one recovery code, grouped for reading, e.g. `7KQM-2XWR-9PTD-4HNC`.
 *
 * @param randomBytes - Source of randomness.
 * @returns The code.
 */
export const newRecoveryCode = (randomBytes: (size: number) => Buffer): string => (
  toCrockford(randomBytes(RECOVERY_CODE_BYTES)).replace(/(.{4})(?=.)/g, '$1-')
);

/**
 * Normalises a typed recovery code: case, dashes and spaces ignored, and the
 * look-alikes O→0, I/L→1 accepted (Crockford).
 *
 * @param code - What the user typed.
 * @returns The canonical code.
 */
export const normalizeRecoveryCode = (code: string): string => code.toUpperCase()
  .replace(/[\s-]/g, '')
  .replace(/O/g, '0')
  .replace(/[IL]/g, '1');

/**
 * Hashes a recovery code for storage. Codes carry 80 random bits, so a fast
 * hash is enough and lets a code be looked up by its hash.
 *
 * @param code - The code, in any accepted spelling.
 * @returns Hex SHA-256 of the canonical code.
 */
export const hashRecoveryCode = (code: string): string => (
  createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex')
);

/**
 * Checks a typed recovery code against a stored hash, in constant time. Marking
 * it used is the caller's job (UserAccessor) — this utility touches no storage.
 *
 * @param code - What the user typed.
 * @param codeHash - A stored hash.
 * @returns `true` when they match.
 */
export const verifyRecoveryCode = (code: string, codeHash: string): boolean => {
  const actual = Buffer.from(hashRecoveryCode(code), 'hex');
  const expected = Buffer.from(codeHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

/** What enrolment returns: the secret and codes to show once, and their stored forms. */
export interface MfaEnrolment {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly recoveryCodes: string[];
  readonly recoveryCodeHashes: string[];
}

/**
 * Creates a TOTP secret and a set of recovery codes for a new user.
 *
 * @param accountLabel - Shown in the authenticator app (the user's email).
 * @param randomBytes - Source of randomness.
 * @returns Secret (base32), `otpauth://` URI for the QR code, codes and their hashes.
 */
export const enrollMfa = (
  accountLabel: string,
  randomBytes: (size: number) => Buffer,
): MfaEnrolment => {
  const secret = new Secret({ buffer: new Uint8Array(randomBytes(20)).buffer }).base32;
  const recoveryCodes = Array.from(
    { length: RECOVERY_CODE_COUNT },
    () => newRecoveryCode(randomBytes),
  );
  return {
    secret,
    otpauthUri: totpFor(secret, accountLabel).toString(),
    recoveryCodes,
    recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
  };
};

/**
 * Checks a TOTP code, allowing one 30-second step of clock drift either way.
 *
 * @param secretBase32 - The user's secret.
 * @param code - The code typed by the user.
 * @param now - Current time.
 * @returns `true` when the code is valid now.
 */
export const verifyTotp = (secretBase32: string, code: string, now: Date): boolean => (
  /^\d{6}$/.test(code)
  && totpFor(secretBase32).validate({
    token: code, timestamp: now.getTime(), window: TOTP_SETTINGS.window,
  }) !== null
);

/**
 * Produces the current TOTP code for a secret (used by tests and the demo seed).
 *
 * @param secretBase32 - The secret.
 * @param now - Current time.
 * @returns The 6-digit code.
 */
export const currentTotp = (secretBase32: string, now: Date): string => (
  totpFor(secretBase32).generate({ timestamp: now.getTime() })
);
