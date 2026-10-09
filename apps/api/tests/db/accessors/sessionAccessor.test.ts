import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createSessionAccessor from '../../../src/accessors/sessionAccessor';
import type { Database } from '../../../src/db/database';
import { users } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const NOW = new Date('2026-10-08T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const hash = (char: string) => char.repeat(64);

type Sessions = ReturnType<typeof createSessionAccessor>;
interface Ids { ana: string; bia: string }

/**
 * Inserts a user to own sessions.
 *
 * @param db - The test database.
 * @param email - Unique email.
 * @returns The user id.
 */
const addUser = async (db: Database, email: string) => {
  const [row] = await db.insert(users).values({
    email, passwordHash: 'x', firstName: 'T', lastName: 'U', mfaSecret: 'x',
  }).returning({ id: users.id });
  return row!.id;
};

/**
 * Runs a test with a fresh accessor and two users, inside a rolled-back transaction.
 *
 * @param work - The test body.
 * @returns A Vitest test function.
 */
const test = (work: (sessions: Sessions, ids: Ids) => Promise<void>) => (
  () => withRollback(pglite, async (db) => {
    const ids = {
      ana: await addUser(db, 'ana@example.com'),
      bia: await addUser(db, 'bia@example.com'),
    };
    await work(createSessionAccessor(db), ids);
  })
);

describe('SessionAccessor', () => {
  it('opens a session storing only the token hash', test(async (sessions, { ana }) => {
    const session = await sessions.insert(ana, hash('a'), 'Firefox on Linux', days(30));

    expect(session)
      .toMatchObject({ userId: ana, deviceInfo: 'Firefox on Linux', expiresAt: days(30) });
    expect(Object.keys(session)).not.toContain('refreshTokenHash');
  }));

  describe('rotate (OQ-100, OQ-106)', () => {
    it('swaps in the new token and slides the expiry', test(async (sessions, { ana }) => {
      const session = await sessions.insert(ana, hash('a'), null, days(30));

      const result = await sessions.rotate(hash('a'), hash('b'), days(31), days(1));

      expect(result).toMatchObject({
        status: 'rotated', session: { id: session.id, expiresAt: days(31), lastUsedAt: days(1) },
      });
      const again = await sessions.rotate(hash('b'), hash('c'), days(32), days(2));

      expect(again.status).toBe('rotated');
    }));

    it('ends the session when a replaced token is reused', test(async (sessions, { ana }) => {
      await sessions.insert(ana, hash('a'), null, days(30));
      await sessions.rotate(hash('a'), hash('b'), days(31), days(1));

      const replay = await sessions.rotate(hash('a'), hash('x'), days(31), days(1));
      const afterwards = await sessions.rotate(hash('b'), hash('c'), days(31), days(1));

      expect(replay).toEqual({ status: 'reused', userId: ana });
      expect(afterwards).toEqual({ status: 'invalid' });
      expect(await sessions.listByUser(ana, NOW)).toEqual([]);
    }));

    it('rejects an unknown or expired token', test(async (sessions, { ana }) => {
      await sessions.insert(ana, hash('a'), null, days(30));

      const unknown = await sessions.rotate(hash('z'), hash('b'), days(31), NOW);
      const expired = await sessions.rotate(hash('a'), hash('b'), days(60), days(30));

      expect(unknown).toEqual({ status: 'invalid' });
      expect(expired).toEqual({ status: 'invalid' });
    }));
  });

  it('lists active sessions, most recent first', test(async (sessions, { ana, bia }) => {
    const older = await sessions.insert(ana, hash('a'), 'Laptop', days(30));
    const recent = await sessions.insert(ana, hash('b'), 'Phone', days(30));
    await sessions.insert(ana, hash('c'), 'Old tablet', days(1));
    await sessions.insert(bia, hash('d'), 'Bia', days(30));
    await sessions.rotate(hash('b'), hash('e'), days(30), days(2));

    const listed = await sessions.listByUser(ana, days(3));

    expect(listed.map((s) => s.id)).toEqual([recent.id, older.id]);
  }));

  describe('ending sessions', () => {
    it('ends one of the user\'s own sessions only', test(async (sessions, { ana, bia }) => {
      const anas = await sessions.insert(ana, hash('a'), null, days(30));
      const bias = await sessions.insert(bia, hash('b'), null, days(30));

      expect(await sessions.deleteForUser(ana, bias.id)).toBe(false);
      expect(await sessions.deleteForUser(ana, anas.id)).toBe(true);
      expect(await sessions.deleteForUser(ana, anas.id)).toBe(false);
      expect(await sessions.listByUser(bia, NOW)).toHaveLength(1);
    }));

    it('ends every session except the current one', test(async (sessions, { ana, bia }) => {
      const current = await sessions.insert(ana, hash('a'), null, days(30));
      await sessions.insert(ana, hash('b'), null, days(30));
      await sessions.insert(ana, hash('c'), null, days(30));
      await sessions.insert(bia, hash('d'), null, days(30));

      expect(await sessions.deleteAllExceptCurrent(ana, current.id)).toBe(2);
      expect((await sessions.listByUser(ana, NOW)).map((s) => s.id)).toEqual([current.id]);
      expect(await sessions.listByUser(bia, NOW)).toHaveLength(1);
    }));

    it('ends every session of a user', test(async (sessions, { ana, bia }) => {
      await sessions.insert(ana, hash('a'), null, days(30));
      await sessions.insert(ana, hash('b'), null, days(30));
      await sessions.insert(bia, hash('c'), null, days(30));

      expect(await sessions.deleteAllForUser(ana)).toBe(2);
      expect(await sessions.listByUser(ana, NOW)).toEqual([]);
      expect(await sessions.listByUser(bia, NOW)).toHaveLength(1);
    }));
  });
});
