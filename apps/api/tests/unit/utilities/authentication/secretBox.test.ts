import { describe, expect, it } from 'vitest';
import {
  openSecret, parseEncryptionKey, sealSecret,
} from '../../../../src/utilities/authentication/secretBox';

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 8);
const IV = Buffer.alloc(12, 1);

describe('parseEncryptionKey', () => {
  it('decodes a base64 32-byte key', () => {
    expect(parseEncryptionKey(KEY.toString('base64'))).toEqual(KEY);
  });

  it.each([Buffer.alloc(31), Buffer.alloc(33)])('rejects a %i-byte key', (key) => {
    expect(() => parseEncryptionKey(key.toString('base64'))).toThrow(/32 bytes/);
  });
});

describe('sealSecret / openSecret (AES-256-GCM)', () => {
  it('round-trips and never stores the plaintext', () => {
    const sealed = sealSecret(KEY, 'JBSWY3DPEHPK3PXP', IV);

    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(openSecret(KEY, sealed)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuses an IV that is not 12 bytes', () => {
    expect(() => sealSecret(KEY, 'x', Buffer.alloc(16))).toThrow(/12 bytes/);
  });

  it('detects the wrong key and any tampering', () => {
    const sealed = sealSecret(KEY, 'secret', IV);
    const [version, iv, tag, ciphertext] = sealed.split('.');
    const flipped = Buffer.from(ciphertext!, 'base64url');
    flipped.writeUInt8((flipped[0]! + 1) % 256, 0);

    expect(() => openSecret(OTHER_KEY, sealed)).toThrow();
    const tampered = [version, iv, tag, flipped.toString('base64url')].join('.');

    expect(() => openSecret(KEY, tampered)).toThrow();
  });

  it.each(['', 'v2.a.b.c', 'v1.a.b', 'v1.a.b.c.d', 'v1..b.c'])(
    'rejects the malformed value %j',
    (value) => {
      expect(() => openSecret(KEY, value)).toThrow(/Unrecognised/);
    },
  );
});
