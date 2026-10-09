import { describe, expect, it } from 'vitest';
import {
  ARGON2_OPTIONS, hashPassword, verifyPassword,
} from '../../../../src/utilities/authentication/passwords';

describe('passwords (Argon2id)', () => {
  it('hashes with Argon2id and the OWASP parameters, salted', async () => {
    const first = await hashPassword('correct horse battery');
    const second = await hashPassword('correct horse battery');

    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(first).not.toBe(second);
    expect(ARGON2_OPTIONS).toMatchObject({ memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');

    expect(await verifyPassword(stored, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(stored, 'correct horse batterY')).toBe(false);
  });

  it('treats an unreadable hash as a mismatch rather than an error', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});
