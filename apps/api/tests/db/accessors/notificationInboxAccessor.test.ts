import type { PGlite } from '@electric-sql/pglite';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createNotificationInboxAccessor from '../../../src/accessors/notificationInboxAccessor';
import type { Database } from '../../../src/db/database';
import { notifications, users } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const NOW = new Date('2026-10-08T12:00:00Z');
const at = (day: string) => new Date(`${day}T00:00:00Z`);
const INVITATION = {
  invitationId: '0199c5a0-0000-7000-8000-000000000011',
  householdId: '0199c5a0-0000-7000-8000-000000000001',
  inviterUserId: '0199c5a0-0000-7000-8000-0000000000b1',
  role: 'Member',
};

type Inbox = ReturnType<typeof createNotificationInboxAccessor>;

/**
 * Inserts a user to own notifications.
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
interface Ids { ana: string; bia: string }

const test = (work: (inbox: Inbox, ids: Ids, db: Database) => Promise<void>) => (
  () => withRollback(pglite, async (db) => {
    const ids = {
      ana: await addUser(db, 'ana@example.com'),
      bia: await addUser(db, 'bia@example.com'),
    };
    await work(createNotificationInboxAccessor(db), ids, db);
  })
);

describe('NotificationInboxAccessor', () => {
  it('stores type + raw params, unseen (OQ-82)', test(async (inbox, { ana }) => {
    const stored = await inbox.insert(ana, 'invitation.received', INVITATION);

    expect(stored).toMatchObject({ type: 'invitation.received', params: INVITATION, seenAt: null });
    expect(Object.keys(stored).sort()).toEqual(['createdAt', 'id', 'params', 'seenAt', 'type']);
  }));

  it('lists newest first, changing nothing', test(async (inbox, { ana, bia }, db) => {
    await db.insert(notifications).values([
      {
        userId: ana,
        type: 'holding.matured',
        params: { holdingName: 'CDB' },
        createdAt: at('2026-10-01'),
      },
      {
        userId: ana, type: 'invitation.received', params: INVITATION, createdAt: at('2026-10-05'),
      },
      {
        userId: bia, type: 'holding.matured', params: {}, createdAt: at('2026-10-06'),
      },
    ]);

    const first = await inbox.listByUser(ana);
    const again = await inbox.listByUser(ana);

    expect(first.map((n) => n.type)).toEqual(['invitation.received', 'holding.matured']);
    expect(again.every((n) => n.seenAt === null)).toBe(true);
  }));

  it('lists an unknown type, for the app\'s fallback', test(async (inbox, { ana }, db) => {
    await db.insert(notifications).values({ userId: ana, type: 'budget.exceeded', params: {} });

    expect((await inbox.listByUser(ana))[0]?.type).toBe('budget.exceeded');
  }));

  describe('markSeen (FR-6.10)', () => {
    it('marks only those shown; a newer one stays unseen', test(async (inbox, { ana }) => {
      const shown = await inbox.insert(ana, 'invitation.received', INVITATION);
      const arrivedLater = await inbox.insert(ana, 'holding.matured', { holdingName: 'LCI' });

      expect(await inbox.markSeen(ana, [shown.id], NOW)).toBe(1);

      const byId = new Map((await inbox.listByUser(ana)).map((n) => [n.id, n.seenAt]));
      expect(byId.get(shown.id)).toEqual(NOW);
      expect(byId.get(arrivedLater.id)).toBeNull();
    }));

    it('ignores others\' and already-seen ones', test(async (inbox, { ana, bia }) => {
      const anas = await inbox.insert(ana, 'invitation.received', INVITATION);
      const bias = await inbox.insert(bia, 'invitation.received', INVITATION);
      await inbox.markSeen(ana, [anas.id], NOW);

      expect(await inbox.markSeen(ana, [anas.id, bias.id], at('2026-10-09'))).toBe(0);
      expect((await inbox.listByUser(ana))[0]?.seenAt).toEqual(NOW);
      expect((await inbox.listByUser(bia))[0]?.seenAt).toBeNull();
    }));

    it('does nothing for an empty list', test(async (inbox, { ana }) => {
      expect(await inbox.markSeen(ana, [], NOW)).toBe(0);
    }));
  });

  describe('deleteForUser', () => {
    it('hard-deletes the user\'s own notification', test(async (inbox, { ana }) => {
      const notification = await inbox.insert(ana, 'invitation.received', INVITATION);

      expect(await inbox.deleteForUser(ana, notification.id)).toBe(true);
      expect(await inbox.listByUser(ana)).toEqual([]);
    }));

    it('refuses others\' or missing ones alike (404)', test(async (inbox, { ana, bia }) => {
      const bias = await inbox.insert(bia, 'invitation.received', INVITATION);

      expect(await inbox.deleteForUser(ana, bias.id)).toBe(false);
      expect(await inbox.deleteForUser(ana, '0199c5a0-0000-7000-8000-00000000dead')).toBe(false);
      expect(await inbox.listByUser(bia)).toHaveLength(1);
    }));
  });
});
