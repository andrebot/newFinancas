import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createUserAccessor, { type NewUser } from '../../../src/accessors/userAccessor';
import type { Database } from '../../../src/db/database';
import { accounts, households } from '../../../src/db/schema';
import type { Theme } from '../../../src/db/schema/values';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const NOW = new Date('2026-10-08T12:00:00Z');
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const ANA: NewUser = {
  email: 'Ana@Example.com',
  firstName: 'Ana',
  lastName: 'Lima',
  passwordHash: '$argon2id$hash',
  encryptedMfaSecret: 'v1.iv.tag.ciphertext',
  recoveryCodeHashes: ['a'.repeat(64), 'b'.repeat(64)],
};

/**
 * Runs a test with a fresh UserAccessor inside a rolled-back transaction.
 *
 * @param work - The test body.
 * @returns A Vitest test function.
 */
type Users = ReturnType<typeof createUserAccessor>;

const test = (work: (users: Users, db: Database) => Promise<void>) => (
  () => withRollback(pglite, (db) => work(createUserAccessor(db), db))
);

/**
 * Registers Ana and returns her id.
 *
 * @param users - The accessor.
 * @returns The new user's id.
 */
const registerAna = async (users: Users) => {
  const result = await users.insert(ANA);
  if (!result.ok) throw new Error('setup failed');
  return result.user.id;
};

describe('UserAccessor', () => {
  describe('insert', () => {
    it('stores the user with defaults (a USER) and no credentials', test(async (users) => {
      const result = await users.insert(ANA);

      expect(result).toMatchObject({
        ok: true,
        user: {
          email: 'Ana@Example.com',
          firstName: 'Ana',
          theme: 'dark',
          language: 'pt-BR',
          systemRole: 'USER',
        },
      });
      expect(result.ok && Object.keys(result.user)).not.toContain('passwordHash');
    }));

    it('honours an explicit language and theme', test(async (users) => {
      const result = await users.insert({ ...ANA, language: 'en-US', theme: 'light' });

      expect(result.ok && [result.user.language, result.user.theme]).toEqual(['en-US', 'light']);
    }));

    it('reports a duplicate email, ignoring case, and writes nothing', test(async (users) => {
      await users.insert(ANA);

      expect(await users.insert({ ...ANA, email: 'ana@EXAMPLE.com' }))
        .toEqual({ ok: false, reason: 'email_taken' });
    }));

    it('throws on an unexpected failure instead of hiding it in a result', test(async (users) => {
      await expect(users.insert({ ...ANA, theme: 'neon' as Theme })).rejects.toThrow();
    }));

    it('stores the recovery-code hashes with the user', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.consumeRecoveryCode(id, 'a'.repeat(64), NOW)).toBe(true);
      expect(await users.consumeRecoveryCode(id, 'b'.repeat(64), NOW)).toBe(true);
    }));
  });

  describe('lookups', () => {
    it('finds by email ignoring case, with credentials', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.findByEmail('ANA@example.COM')).toMatchObject({
        id,
        passwordHash: '$argon2id$hash',
        encryptedMfaSecret: 'v1.iv.tag.ciphertext',
        mfaConfirmedAt: null,
      });
      expect(await users.findByEmail('nobody@example.com')).toBeUndefined();
    }));

    it('finds by id without credentials; reads the hash on its own', test(async (users) => {
      const id = await registerAna(users);
      const found = await users.findById(id);

      expect(found).toMatchObject({ id, email: 'Ana@Example.com', lastName: 'Lima' });
      expect(found && 'passwordHash' in found).toBe(false);
      expect(await users.findPasswordHash(id)).toBe('$argon2id$hash');
      expect(await users.findById('0199c5a0-0000-7000-8000-000000000000')).toBeUndefined();
      expect(await users.findPasswordHash('0199c5a0-0000-7000-8000-000000000000')).toBeUndefined();
    }));
  });

  describe('update / updatePasswordHash', () => {
    it('changes only the given fields', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.update(id, { lastName: 'Souza', theme: 'light' }))
        .toMatchObject({
          firstName: 'Ana', lastName: 'Souza', theme: 'light', language: 'pt-BR',
        });
    }));

    it('returns undefined / false for an unknown user', test(async (users) => {
      const unknown = '0199c5a0-0000-7000-8000-000000000000';

      expect(await users.update(unknown, { firstName: 'X' })).toBeUndefined();
      expect(await users.updatePasswordHash(unknown, 'h')).toBe(false);
    }));

    it('replaces the password hash', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.updatePasswordHash(id, '$argon2id$new')).toBe(true);
      expect(await users.findPasswordHash(id)).toBe('$argon2id$new');
    }));
  });

  describe('consumeRecoveryCode (FR-1.16)', () => {
    it('works once per code, only for its owner', test(async (users) => {
      const id = await registerAna(users);
      const other = await users.insert({
        ...ANA, email: 'bia@example.com', recoveryCodeHashes: [],
      });
      const otherId = other.ok ? other.user.id : '';

      expect(await users.consumeRecoveryCode(otherId, 'a'.repeat(64), NOW)).toBe(false);
      expect(await users.consumeRecoveryCode(id, 'a'.repeat(64), NOW)).toBe(true);
      expect(await users.consumeRecoveryCode(id, 'a'.repeat(64), NOW)).toBe(false);
      expect(await users.consumeRecoveryCode(id, 'c'.repeat(64), NOW)).toBe(false);
    }));
  });

  describe('consumeTotpStep (OQ-163)', () => {
    it('accepts each step once, and never one at or before the last', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.consumeTotpStep(id, 100)).toBe(true);
      expect(await users.consumeTotpStep(id, 100)).toBe(false);
      expect(await users.consumeTotpStep(id, 99)).toBe(false);
      expect(await users.consumeTotpStep(id, 101)).toBe(true);
    }));

    it('is per user, and refuses a user who is gone', test(async (users) => {
      const id = await registerAna(users);
      const other = await users.insert({
        ...ANA, email: 'bia@example.com', recoveryCodeHashes: [],
      });
      const otherId = other.ok ? other.user.id : '';
      await users.consumeTotpStep(id, 100);

      expect(await users.consumeTotpStep(otherId, 100)).toBe(true);
      expect(await users.consumeTotpStep('01a14673-0000-7000-8000-000000000000', 1)).toBe(false);
    }));
  });

  describe('MFA enrollment (OQ-149)', () => {
    const FRESH = { encryptedMfaSecret: 'v1.fresh', recoveryCodeHashes: ['c'.repeat(64)] };

    it('replaces an unconfirmed secret and every recovery code', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.replaceMfaEnrollment(id, FRESH)).toBe('replaced');
      expect(await users.findByEmail(ANA.email))
        .toMatchObject({ encryptedMfaSecret: 'v1.fresh', mfaConfirmedAt: null });
      expect(await users.consumeRecoveryCode(id, 'a'.repeat(64), NOW)).toBe(false);
      expect(await users.consumeRecoveryCode(id, 'c'.repeat(64), NOW)).toBe(true);
    }));

    it('forgets the last code step with the old secret', test(async (users) => {
      const id = await registerAna(users);
      await users.consumeTotpStep(id, 100);

      await users.replaceMfaEnrollment(id, FRESH);

      expect(await users.consumeTotpStep(id, 100)).toBe(true);
    }));

    it('stores no codes when the enrollment brings none', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.replaceMfaEnrollment(id, { ...FRESH, recoveryCodeHashes: [] }))
        .toBe('replaced');
      expect(await users.consumeRecoveryCode(id, 'a'.repeat(64), NOW)).toBe(false);
    }));

    it('confirms once; a confirmed enrollment is never replaced', test(async (users) => {
      const id = await registerAna(users);

      expect(await users.confirmMfaEnrollment(id, NOW)).toBe('confirmed');
      expect(await users.confirmMfaEnrollment(id, later(1))).toBe('stale');
      expect(await users.replaceMfaEnrollment(id, FRESH)).toBe('stale');
      expect(await users.findByEmail(ANA.email))
        .toMatchObject({ encryptedMfaSecret: ANA.encryptedMfaSecret, mfaConfirmedAt: NOW });
      expect(await users.consumeRecoveryCode(id, 'a'.repeat(64), NOW)).toBe(true);
    }));

    it('answers stale for an unknown user', test(async (users) => {
      const unknown = '0199c5a0-0000-7000-8000-000000000000';

      expect(await users.confirmMfaEnrollment(unknown, NOW)).toBe('stale');
      expect(await users.replaceMfaEnrollment(unknown, FRESH)).toBe('stale');
    }));
  });

  describe('reset tokens (FR-1.13)', () => {
    it('consume an unused, unexpired token exactly once', test(async (users) => {
      const id = await registerAna(users);
      await users.storeResetToken(id, 't'.repeat(64), later(30));

      expect(await users.consumeResetToken('t'.repeat(64), later(10))).toBe(id);
      expect(await users.consumeResetToken('t'.repeat(64), later(11))).toBeUndefined();
    }));

    it('refuse an expired or unknown token', test(async (users) => {
      const id = await registerAna(users);
      await users.storeResetToken(id, 'e'.repeat(64), later(30));

      expect(await users.consumeResetToken('e'.repeat(64), later(30))).toBeUndefined();
      expect(await users.consumeResetToken('u'.repeat(64), NOW)).toBeUndefined();
    }));
  });

  describe('login lockout counter (OQ-114)', () => {
    const KEY = 'ana@example.com';

    it('counts failures within the window and forgets older ones', test(async (users) => {
      expect(await users.recordLoginFailure(KEY, NOW, later(-15))).toBe(1);
      expect(await users.recordLoginFailure(KEY, later(5), later(-10))).toBe(2);
      expect(await users.recordLoginFailure(KEY, later(10), later(-5))).toBe(3);

      // The window began at NOW; a failure whose window starts after it begins again.
      expect(await users.recordLoginFailure(KEY, later(20), later(1))).toBe(1);
      expect(await users.recordLoginFailure(KEY, later(21), later(6))).toBe(2);
    }));

    it('keeps each address separate, whether or not it has an account', test(async (users) => {
      await users.recordLoginFailure(KEY, NOW, later(-15));

      expect(await users.recordLoginFailure('nobody@example.com', NOW, later(-15))).toBe(1);
      expect(await users.recordLoginFailure(KEY, NOW, later(-15))).toBe(2);
    }));

    it('locks an address, and a success clears the count and the lock', test(async (users) => {
      expect(await users.findLoginLock(KEY)).toBeUndefined();
      await users.recordLoginFailure(KEY, NOW, later(-15));

      expect(await users.findLoginLock(KEY)).toBeUndefined();
      await users.lockLogin(KEY, later(15));
      expect(await users.findLoginLock(KEY)).toEqual(later(15));

      await users.clearLoginFailures(KEY);
      expect(await users.findLoginLock(KEY)).toBeUndefined();
      expect(await users.recordLoginFailure(KEY, NOW, later(-15))).toBe(1);
    }));
  });

  describe('delete', () => {
    it('removes the user and their credentials', test(async (users) => {
      const id = await registerAna(users);
      await users.storeResetToken(id, 't'.repeat(64), later(30));

      expect(await users.delete(id)).toBe('deleted');
      expect(await users.findById(id)).toBeUndefined();
      expect(await users.consumeResetToken('t'.repeat(64), NOW)).toBeUndefined();
      expect(await users.delete(id)).toBe('not_found');
    }));

    it('throws on an unexpected failure (e.g. a malformed id)', test(async (users) => {
      await expect(users.delete('not-a-uuid')).rejects.toThrow();
    }));

    it('refuses while references remain (FR-1.17 not done)', test(async (users, db) => {
      const id = await registerAna(users);
      const [household] = await db.insert(households).values({ name: 'Home' }).returning();
      await db.insert(accounts).values({
        householdId: household!.id,
        ownerUserId: id,
        name: 'A',
        type: 'checking',
        currency: 'BRL',
        visibility: 'personal',
        startingBalanceDate: '2026-01-01',
      });

      expect(await users.delete(id)).toBe('still_referenced');
      expect(await users.findById(id)).toBeDefined();
    }));
  });
});
