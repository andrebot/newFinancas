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

  describe('addMember / updateRole', () => {
    it('adds a member once', test(async ({ households, user }) => {
      const home = await households.insert('Casa', await user('ana'));
      const bia = await user('bia');

      expect(await households.addMember(home.id, bia, 'Member')).toBe('added');
      expect(await households.addMember(home.id, bia, 'Admin')).toBe('already_member');
      expect(await households.findMembership(home.id, bia)).toMatchObject({ role: 'Member' });
    }));

    it('changes a role but never the Owner\'s (FR-1.12)', test(async ({
      households, user, join,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const bia = await user('bia');
      await join(home.id, bia, 'Member', 1);

      expect(await households.updateRole(home.id, bia, 'Admin')).toBe('updated');
      expect(await households.updateRole(home.id, ana, 'Viewer')).toBe('is_owner');
      expect(await households.updateRole(home.id, await user('out'), 'Viewer')).toBe('not_member');
      expect(await households.findMembership(home.id, ana)).toMatchObject({ role: 'Owner' });
    }));

    it('throws on an unexpected failure', test(async ({ households, user }) => {
      const ana = await user('ana');

      await expect(households.addMember('not-a-uuid', ana, 'Member')).rejects.toThrow();
    }));
  });

  describe('transitionMembership (FR-1.11, FR-1.18)', () => {
    it('removes a non-Owner member, whoever does it', test(async ({ households, user, join }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const bia = await user('bia');
      await join(home.id, bia, 'Member', 1);

      const result = await households.transitionMembership(home.id, bia, ana);

      expect(result).toEqual({ status: 'removed' });
      expect(await households.findMembership(home.id, bia)).toBeUndefined();
    }));

    it('refuses to let anyone else remove the Owner (OQ-27)', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const admin = await user('adi');
      await join(home.id, admin, 'Admin', 1);

      const result = await households.transitionMembership(home.id, ana, admin);

      expect(result).toEqual({ status: 'owner_protected' });
      expect((await roles(home.id))[ana]).toBe('Owner');
    }));

    it('promotes Admin over Member, the longest-tenured first', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const oldMember = await user('mem');
      const newAdmin = await user('new');
      const oldAdmin = await user('old');
      await join(home.id, oldMember, 'Member', 90);
      await join(home.id, newAdmin, 'Admin', 2);
      await join(home.id, oldAdmin, 'Admin', 30);

      const result = await households.transitionMembership(home.id, ana, ana);

      expect(result).toEqual({ status: 'removed', promotedUserId: oldAdmin });
      expect(await roles(home.id))
        .toEqual({ [oldMember]: 'Member', [newAdmin]: 'Admin', [oldAdmin]: 'Owner' });
    }));

    it('falls back to Member, then Viewer', test(async ({ households, user, join }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const viewer = await user('vic');
      await join(home.id, viewer, 'Viewer', 90);

      const result = await households.transitionMembership(home.id, ana, ana);

      expect(result).toEqual({ status: 'removed', promotedUserId: viewer });
    }));

    it('dissolves the household when the Owner was last', test(async ({ households, user }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);

      const result = await households.transitionMembership(home.id, ana, ana);

      expect(result).toEqual({ status: 'household_deleted' });
      expect(await households.listForUser(ana)).toEqual([]);
    }));

    it('reports a non-member', test(async ({ households, user }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);

      const outsider = await user('out');

      expect(await households.transitionMembership(home.id, outsider, ana))
        .toEqual({ status: 'not_member' });
    }));
  });

  describe('transferOwnership (FR-1.20, OQ-28)', () => {
    it('swaps atomically: target becomes Owner, old Owner Admin, exactly one Owner', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const bia = await user('bia');
      await join(home.id, bia, 'Viewer', 1);

      expect(await households.transferOwnership(home.id, ana, bia)).toBe('transferred');
      expect(await roles(home.id)).toEqual({ [ana]: 'Admin', [bia]: 'Owner' });
    }));

    it('refuses a non-Owner, a non-member target, and the Owner themself', test(async ({
      households, user, join, roles,
    }) => {
      const ana = await user('ana');
      const home = await households.insert('Casa', ana);
      const admin = await user('adi');
      await join(home.id, admin, 'Admin', 1);

      expect(await households.transferOwnership(home.id, admin, admin)).toBe('not_owner');
      const outsider = await user('out');

      expect(await households.transferOwnership(home.id, ana, outsider)).toBe('target_not_member');
      expect(await households.transferOwnership(home.id, ana, ana)).toBe('target_not_member');
      expect((await roles(home.id))[ana]).toBe('Owner');
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
