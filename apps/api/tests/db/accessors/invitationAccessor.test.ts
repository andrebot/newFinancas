import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createInvitationAccessor from '../../../src/accessors/invitationAccessor';
import type { Database } from '../../../src/db/database';
import { households, invitations, users } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

const NOW = new Date('2026-10-09T12:00:00Z');

type Invites = ReturnType<typeof createInvitationAccessor>;
interface Setup {
  readonly invites: Invites;
  readonly db: Database;
  readonly home: string;
  readonly ana: string;
  readonly bia: string;
}

/**
 * Inserts a user.
 *
 * @param db - The test database.
 * @param name - First name; also the email's local part.
 * @returns The user id.
 */
const addUser = async (db: Database, name: string) => {
  const [row] = await db.insert(users).values({
    email: `${name}@example.com`,
    passwordHash: 'x',
    firstName: name,
    lastName: 'Silva',
    mfaSecret: 'x',
  }).returning({ id: users.id });
  return row!.id;
};

/**
 * Runs a test with an accessor, a household "Casa", Ana (inviter) and Bia (invitee),
 * inside a rolled-back transaction.
 *
 * @param work - The test body.
 * @returns A Vitest test function.
 */
const test = (work: (setup: Setup) => Promise<void>) => () => withRollback(pglite, async (db) => {
  const [household] = await db.insert(households).values({ name: 'Casa' })
    .returning({ id: households.id });
  await work({
    invites: createInvitationAccessor(db),
    db,
    home: household!.id,
    ana: await addUser(db, 'ana'),
    bia: await addUser(db, 'bia'),
  });
});

/**
 * Invites Bia to Casa as a Member, on Ana's behalf.
 *
 * @param setup - The test setup.
 * @returns The new invitation's id.
 */
const inviteBia = async ({
  invites, home, ana, bia,
}: Setup) => {
  const result = await invites.insert({
    householdId: home, invitedUserId: bia, invitedByUserId: ana, role: 'Member',
  });
  if (!result.ok) throw new Error('setup failed');
  return result.invitation.id;
};

describe('InvitationAccessor', () => {
  it('records a pending invitation', test(async ({
    invites, home, ana, bia,
  }) => {
    const result = await invites.insert({
      householdId: home, invitedUserId: bia, invitedByUserId: ana, role: 'Admin',
    });

    expect(result).toMatchObject({
      ok: true,
      invitation: {
        householdId: home,
        invitedUserId: bia,
        invitedByUserId: ana,
        role: 'Admin',
        status: 'pending',
        resolvedAt: null,
      },
    });
  }));

  it('reports an invitee that no longer exists (FR-1.19)', test(async ({ invites, home, ana }) => {
    const ghost = '0199c5a0-0000-7000-8000-00000000dead';

    expect(await invites.insert({
      householdId: home, invitedUserId: ghost, invitedByUserId: ana, role: 'Member',
    }))
      .toEqual({ ok: false, reason: 'invitee_missing' });
  }));

  it('throws on an unexpected failure', test(async ({ invites, ana, bia }) => {
    await expect(invites.insert({
      householdId: 'not-a-uuid', invitedUserId: bia, invitedByUserId: ana, role: 'Member',
    })).rejects.toThrow();
  }));

  it('finds by id, and finds a pending invitation for a household and user', test(async (setup) => {
    const id = await inviteBia(setup);

    expect(await setup.invites.findById(id)).toMatchObject({ id, status: 'pending' });
    expect(await setup.invites.findPending(setup.home, setup.bia)).toMatchObject({ id });
    expect(await setup.invites.findPending(setup.home, setup.ana)).toBeUndefined();
    expect(await setup.invites.findById('0199c5a0-0000-7000-8000-00000000dead')).toBeUndefined();
  }));

  describe('listPendingForUser (FR-1.10)', () => {
    it('shows household and inviter names, pending only, newest first', test(async (setup) => {
      const { invites, db, bia } = setup;
      const older = await inviteBia(setup);
      const [other] = await db.insert(households).values({ name: 'Praia' })
        .returning({ id: households.id });
      const newer = await invites.insert({
        householdId: other!.id, invitedUserId: bia, invitedByUserId: setup.ana, role: 'Viewer',
      });
      await db.update(invitations).set({ createdAt: new Date('2026-10-01T00:00:00Z') })
        .where(eq(invitations.id, older));

      const received = await invites.listPendingForUser(bia);

      expect(received.map((r) => [r.householdName, r.role, r.inviterFirstName])).toEqual([
        ['Praia', 'Viewer', 'ana'], ['Casa', 'Member', 'ana'],
      ]);
      expect(newer.ok && received[0]?.id).toBe(newer.ok && newer.invitation.id);
    }));

    it('keeps one whose inviter was deleted, without a name', test(async (setup) => {
      const { invites, db, bia } = setup;
      const id = await inviteBia(setup);
      await db.update(invitations).set({ invitedByUserId: null }).where(eq(invitations.id, id));

      expect(await invites.listPendingForUser(bia)).toEqual([expect.objectContaining({
        id, invitedByUserId: null, inviterFirstName: null, inviterLastName: null,
      })]);
    }));

    it('leaves out resolved invitations', test(async (setup) => {
      const id = await inviteBia(setup);
      await setup.invites.resolve(id, 'declined', NOW);

      expect(await setup.invites.listPendingForUser(setup.bia)).toEqual([]);
    }));
  });

  it('lists every invitation of a household, all statuses', test(async (setup) => {
    const first = await inviteBia(setup);
    await setup.invites.resolve(first, 'revoked', NOW);
    const second = await inviteBia(setup);

    const listed = await setup.invites.listForHousehold(setup.home);

    expect(listed.map((i) => i.id).sort()).toEqual([first, second].sort());
    expect(listed.find((i) => i.id === first))
      .toMatchObject({ status: 'revoked', resolvedAt: NOW });
  }));

  describe('resolve (guarded, FR-1.10)', () => {
    it.each(['accepted', 'declined', 'revoked'] as const)('resolves as %s, once', (resolution) => (
      test(async (setup) => {
        const id = await inviteBia(setup);

        expect(await setup.invites.resolve(id, resolution, NOW)).toBe('resolved');
        expect(await setup.invites.findById(id))
          .toMatchObject({ status: resolution, resolvedAt: NOW });
        expect(await setup.invites.resolve(id, 'revoked', NOW)).toBe('stale');
        expect((await setup.invites.findById(id))?.status).toBe(resolution);
      })()
    ));

    it('is stale for an unknown invitation', test(async ({ invites }) => {
      const unknown = '0199c5a0-0000-7000-8000-00000000dead';

      expect(await invites.resolve(unknown, 'accepted', NOW)).toBe('stale');
    }));
  });
});
