import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import createHouseholdAccessor, { type Role } from '../../../src/accessors/householdAccessor';
import type { Database } from '../../../src/db/database';
import { householdMemberships, users } from '../../../src/db/schema';
import { createMigratedDatabase, withRollback } from '../support/database';

let pglite: PGlite;
beforeAll(async () => {
  pglite = await createMigratedDatabase();
});
afterAll(async () => {
  await pglite.close();
});

type Households = ReturnType<typeof createHouseholdAccessor>;

/** Helpers bound to one test's database. */
interface Kit {
  readonly households: Households;
  /** Inserts a user named `name`; returns the id. */
  readonly user: (name: string) => Promise<string>;
  /** Adds a member with a given role, joined `daysAgo` days ago (tenure). */
  readonly join: (
    householdId: string, userId: string, role: Role, daysAgo: number,
  ) => Promise<void>;
  /** Roles in a household, by user id. */
  readonly roles: (householdId: string) => Promise<Record<string, string>>;
}

/**
 * Runs a test with a fresh accessor and helpers, inside a rolled-back transaction.
 *
 * @param work - The test body.
 * @returns A Vitest test function.
 */
const test = (work: (kit: Kit) => Promise<void>) => () => withRollback(pglite, async (
  db: Database,
) => {
  const kit: Kit = {
    households: createHouseholdAccessor(db),
    user: async (name) => {
      const [row] = await db.insert(users).values({
        email: `${name}@example.com`,
        passwordHash: 'x',
        firstName: name,
        lastName: 'T',
        mfaSecret: 'x',
      }).returning({ id: users.id });
      return row!.id;
    },
    join: async (householdId, userId, role, daysAgo) => {
      await db.insert(householdMemberships).values({
        householdId, userId, role, joinedAt: new Date(Date.now() - daysAgo * 86_400_000),
      });
    },
    roles: async (householdId) => Object.fromEntries((await db.select({
      userId: householdMemberships.userId, role: householdMemberships.role,
    }).from(householdMemberships).where(eq(householdMemberships.householdId, householdId)))
      .map((m) => [m.userId, m.role])),
  };
  await work(kit);
});

describe('HouseholdAccessor', () => {
  describe('creating and reading', () => {
    it('creates the household with its creator as Owner', test(async ({ households, user }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);

      expect(home.name).toBe('Casa');
      expect(await households.findMembership(home.id, ana)).toMatchObject({ role: 'Owner' });
      expect(await households.listForUser(ana))
        .toEqual([expect.objectContaining({ id: home.id, role: 'Owner' })]);
    }));

    it('lists members, Owner first then succession order', test(async ({
      households, user, join,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const viewer = await user('vic');
      const admin = await user('adi');
      await join(home.id, viewer, 'Viewer', 5);
      await join(home.id, admin, 'Admin', 1);

      const members = await households.listMembers(home.id);

      expect(members.map((m) => [m.firstName, m.role]))
        .toEqual([['ana', 'Owner'], ['adi', 'Admin'], ['vic', 'Viewer']]);
      expect(members[0]?.email).toBe('ana@example.com');
    }));

    it('reports no membership for an outsider', test(async ({ households, user }) => {
      const home = await households.insert('Casa', await user('ana'));

      expect(await households.findMembership(home.id, await user('out'))).toBeUndefined();
      expect(await households.listForUser(await user('nobody'))).toEqual([]);
    }));
  });

  describe('findSuccessor (FR-1.18 ordering)', () => {
    it('prefers Admin over Member, the longest-tenured first', test(async ({
      households, user, join,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const oldMember = await user('mem');
      const newAdmin = await user('new');
      const oldAdmin = await user('old');
      await join(home.id, oldMember, 'Member', 90);
      await join(home.id, newAdmin, 'Admin', 2);
      await join(home.id, oldAdmin, 'Admin', 30);

      expect(await households.findSuccessor(home.id, ana))
        .toEqual({ userId: oldAdmin, role: 'Admin' });
    }));

    it('falls back to a Viewer, and finds nobody when the Owner is alone', test(async ({
      households, user, join,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);

      expect(await households.findSuccessor(home.id, ana)).toBeUndefined();

      const viewer = await user('vic');
      await join(home.id, viewer, 'Viewer', 1);

      expect(await households.findSuccessor(home.id, ana))
        .toEqual({ userId: viewer, role: 'Viewer' });
    }));
  });

  describe('addMember', () => {
    it('adds a member once', test(async ({ households, user }) => {
      const home = await households.insert('Casa', await user('ana'));
      const bia = await user('bia');

      expect(await households.addMember(home.id, bia, 'Member')).toBe('added');
      expect(await households.addMember(home.id, bia, 'Admin')).toBe('already_member');
      expect(await households.findMembership(home.id, bia)).toMatchObject({ role: 'Member' });
    }));

    it('throws on an unexpected failure', test(async ({ households, user }) => {
      const ana = await user('ana');

      await expect(households.addMember('not-a-uuid', ana, 'Member')).rejects.toThrow();
    }));
  });

  describe('guarded writes (OQ-107)', () => {
    it('updateRole applies to a non-Owner member, else is stale', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const bia = await user('bia');
      await join(home.id, bia, 'Member', 1);

      expect(await households.updateRole(home.id, bia, 'Admin')).toBe('updated');
      expect(await households.updateRole(home.id, ana, 'Viewer')).toBe('stale');
      expect(await households.updateRole(home.id, await user('out'), 'Viewer')).toBe('stale');
      expect(await roles(home.id)).toEqual({ [ana]: 'Owner', [bia]: 'Admin' });
    }));

    it('removeMember removes a non-Owner, never the Owner', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const bia = await user('bia');
      await join(home.id, bia, 'Member', 1);

      expect(await households.removeMember(home.id, ana)).toBe('stale');
      expect(await households.removeMember(home.id, bia)).toBe('removed');
      expect(await households.removeMember(home.id, bia)).toBe('stale');
      expect(await roles(home.id)).toEqual({ [ana]: 'Owner' });
    }));

    it('swapOwner swaps atomically: exactly one Owner, the old one Admin', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const bia = await user('bia');
      await join(home.id, bia, 'Viewer', 1);

      expect(await households.swapOwner(home.id, ana, bia)).toBe('swapped');
      expect(await roles(home.id)).toEqual({ [ana]: 'Admin', [bia]: 'Owner' });
    }));

    it('swapOwner is stale and changes nothing when `from` is no longer Owner', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const bia = await user('bia');
      const cai = await user('cai');
      await join(home.id, bia, 'Admin', 1);
      await join(home.id, cai, 'Member', 1);

      expect(await households.swapOwner(home.id, bia, cai)).toBe('stale');
      expect(await roles(home.id)).toEqual({ [ana]: 'Owner', [bia]: 'Admin', [cai]: 'Member' });
    }));

    it('swapOwner rolls back the demotion when `to` is gone or is `from`', test(async ({
      households, user, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const outsider = await user('out');

      expect(await households.swapOwner(home.id, ana, outsider)).toBe('stale');
      expect(await households.swapOwner(home.id, ana, ana)).toBe('stale');
      expect(await roles(home.id)).toEqual({ [ana]: 'Owner' });
    }));

    it('swapOwner throws on an unexpected failure', test(async ({ households, user }) => {
      const ana = await user('ana');

      await expect(households.swapOwner('not-a-uuid', ana, ana)).rejects.toThrow();
    }));
  });

  it('dissolves a household with its memberships', test(async ({ households, user, roles }) => {
    const ana = await user('ana');
    const home = await households.insert('Casa', ana);

    expect(await households.delete(home.id)).toBe(true);
    expect(await roles(home.id)).toEqual({});
    expect(await households.delete(home.id)).toBe(false);
  }));
});
