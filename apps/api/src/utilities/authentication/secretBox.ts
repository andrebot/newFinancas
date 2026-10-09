import { createCipheriv, createDecipheriv } from 'node:crypto';

// Encryption at rest for secrets that must be read back, i.e. the TOTP secret
// (NFR-SEC-3): AES-256-GCM, authenticated, so tampering is detected.

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;

/**
 * Decodes and checks an encryption key from configuration.
 *
 * @param base64 - A base64-encoded 32-byte key (e.g. `openssl rand -base64 32`).
 * @returns The key bytes.
 * @throws {Error} When it does not decode to exactly 32 bytes.
 */
export const parseEncryptionKey = (base64: string): Buffer => {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('Encryption key must be 32 bytes, base64-encoded');
  return key;
};

/**
 * Encrypts a secret for storage.
 *
 * @param key - 32-byte key.
 * @param plaintext - The secret.
 * @param iv - 12 random bytes, unique per encryption.
 * @returns `v1.<iv>.<tag>.<ciphertext>`, each part base64url.
 */
export const sealSecret = (key: Buffer, plaintext: string, iv: Buffer): string => {
  if (iv.length !== IV_BYTES) throw new Error('IV must be 12 bytes');
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
};

/**
 * Decrypts a secret sealed by `sealSecret`.
 *
 * @param key - The same 32-byte key.
 * @param sealed - The stored value.
 * @returns The secret.
 * @throws {Error} When the format is wrong, the key differs, or the value was altered.
 */
export const openSecret = (key: Buffer, sealed: string): string => {
  const [version, iv, tag, ciphertext, ...extra] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined || extra.length > 0) {
    throw new Error('Unrecognised sealed secret');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final(),
  ]).toString('utf8');
};
