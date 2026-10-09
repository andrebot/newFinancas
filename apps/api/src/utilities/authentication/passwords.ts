import { hash, verify, type Options } from '@node-rs/argon2';

// Password hashing (NFR-SEC-4, OQ-100): Argon2id with OWASP's recommended
// parameters. They are stored inside each hash, so raising them later still
// verifies older hashes.

// `Algorithm` is a const enum, which isolated modules can't import as a value;
// 2 is Algorithm.Argon2id.
const ARGON2ID = 2 as NonNullable<Options['algorithm']>;

export const ARGON2_OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // KiB (19 MiB)
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hashes a password for storage.
 *
 * @param password - The plain-text password (length rules are ValidationUtility's).
 * @returns The encoded Argon2id hash (includes salt and parameters).
 */
export const hashPassword = (password: string): Promise<string> => hash(password, ARGON2_OPTIONS);

/**
 * Checks a password against a stored hash.
 *
 * @param passwordHash - The stored hash.
 * @param password - The password to check.
 * @returns `true` when it matches; `false` for a mismatch or an unreadable hash.
 */
export const verifyPassword = async (passwordHash: string, password: string): Promise<boolean> => (
  verify(passwordHash, password).catch(() => false)
);
