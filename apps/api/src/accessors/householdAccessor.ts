import {
  and, asc, eq, ne, sql, TransactionRollbackError,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '../db/errors';
import { householdMemberships, households, users } from '../db/schema';
import type { ROLES } from '../db/schema/values';

// HouseholdAccessor (A3, VBD): households and memberships. It only applies data
// changes; every business decision — who may remove whom, who succeeds the
// Owner, when a household is dissolved — is IdentityManager's (OQ-107).
// Writes that depend on facts the Manager read are *guarded*: they re-state
// those facts in their WHERE clause and return 'stale' when they no longer
// hold, so a concurrent change can't be applied over (OQ-107).

export type Role = (typeof ROLES)[number];
/** Roles `updateRole` can set; Owner moves only through `swapOwner`. */
export type AssignableRole = Exclude<Role, 'Owner'>;

export interface Household {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

/** A household the user belongs to, with their role in it. */
export interface UserHousehold extends Household {
  readonly role: Role;
}

/** A member as the members list shows them. */
export interface Member {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly role: Role;
  readonly joinedAt: Date;
}

/** A guarded write either applied, or found its preconditions no longer true. */
export type Guarded<Applied extends string> = Applied | 'stale';

/** Succession order (FR-1.18): Admin, then Member, then Viewer. */
const SUCCESSION_RANK = sql`CASE ${householdMemberships.role}
  WHEN 'Admin' THEN 1 WHEN 'Member' THEN 2 ELSE 3 END`;

/**
 * The condition selecting one user's membership of one household.
 *
 * @param householdId - The household.
 * @param userId - The user.
 * @returns The SQL condition.
 */
const memberIs = (householdId: string, userId: string) => and(
  eq(householdMemberships.householdId, householdId),
  eq(householdMemberships.userId, userId),
);

/**
 * Builds the HouseholdAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createHouseholdAccessor = (db: Database) => ({
  /**
   * Creates a household with its creator as Owner, atomically.
   *
   * @param name - Household name.
   * @param ownerUserId - The creator.
   * @returns The household.
   */
  insert: (name: string, ownerUserId: string): Promise<Household> => db.transaction(async (tx) => {
    const [household] = await tx.insert(households).values({ name })
      .returning({ id: households.id, name: households.name, createdAt: households.createdAt });
    await tx.insert(householdMemberships)
      .values({ householdId: household!.id, userId: ownerUserId, role: 'Owner' });
    return household!;
  }),

  /**
   * Reads a user's role in a household.
   *
   * @param householdId - The household.
   * @param userId - The user.
   * @returns Role and join date, or `undefined` when not a member.
   */
  findMembership: async (householdId: string, userId: string) => {
    const [row] = await db
      .select({ role: householdMemberships.role, joinedAt: householdMemberships.joinedAt })
      .from(householdMemberships)
      .where(memberIs(householdId, userId));
    return row && { role: row.role as Role, joinedAt: row.joinedAt };
  },

  /**
   * Lists the households a user belongs to, with their role, oldest membership first.
   *
   * @param userId - The user.
   * @returns The households.
   */
  listForUser: async (userId: string): Promise<UserHousehold[]> => (
    await db.select({
      id: households.id,
      name: households.name,
      createdAt: households.createdAt,
      role: householdMemberships.role,
    }).from(householdMemberships)
      .innerJoin(households, eq(households.id, householdMemberships.householdId))
      .where(eq(householdMemberships.userId, userId))
      .orderBy(asc(householdMemberships.joinedAt))
  ) as UserHousehold[],

  /**
   * Lists a household's members with their names (a read-only join on users).
   *
   * @param householdId - The household.
   * @returns Members, Owner first, then in succession order.
   */
  listMembers: async (householdId: string): Promise<Member[]> => (
    await db.select({
      userId: householdMemberships.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: householdMemberships.role,
      joinedAt: householdMemberships.joinedAt,
    }).from(householdMemberships)
      .innerJoin(users, eq(users.id, householdMemberships.userId))
      .where(eq(householdMemberships.householdId, householdId))
      .orderBy(
        sql`${householdMemberships.role} = 'Owner' DESC`,
        SUCCESSION_RANK,
        asc(householdMemberships.joinedAt),
      )
  ) as Member[],

  /**
   * Finds who is next in line for Owner: the longest-tenured Admin, else Member,
   * else Viewer (FR-1.18's ordering). Deciding to promote them is the Manager's.
   *
   * @param householdId - The household.
   * @param excludingUserId - The departing Owner.
   * @returns The successor, or `undefined` when nobody else is a member.
   */
  findSuccessor: async (householdId: string, excludingUserId: string) => {
    const [row] = await db
      .select({ userId: householdMemberships.userId, role: householdMemberships.role })
      .from(householdMemberships)
      .where(and(
        eq(householdMemberships.householdId, householdId),
        ne(householdMemberships.userId, excludingUserId),
      ))
      .orderBy(SUCCESSION_RANK, asc(householdMemberships.joinedAt), asc(householdMemberships.id))
      .limit(1);
    return row && { userId: row.userId, role: row.role as Role };
  },

  /**
   * Adds a member (accepting an invitation).
   *
   * @param householdId - The household.
   * @param userId - The new member.
   * @param role - The invited role.
   * @returns `added`, or `already_member`.
   */
  addMember: async (
    householdId: string,
    userId: string,
    role: AssignableRole,
  ): Promise<'added' | 'already_member'> => {
    try {
      await db.transaction((tx) => tx.insert(householdMemberships)
        .values({ householdId, userId, role }));
      return 'added';
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) return 'already_member';
      throw error;
    }
  },

  /**
   * Sets a member's role to Admin, Member or Viewer. Guarded: applies only while
   * the user is a member who is not the Owner — demoting the Owner here would
   * leave the household without one.
   *
   * @param householdId - The household.
   * @param userId - The member.
   * @param role - The new role.
   * @returns `updated`, or `stale` (not a member, or the Owner).
   */
  updateRole: async (
    householdId: string,
    userId: string,
    role: AssignableRole,
  ): Promise<Guarded<'updated'>> => {
    const updated = await db.update(householdMemberships).set({ role })
      .where(and(memberIs(householdId, userId), ne(householdMemberships.role, 'Owner')))
      .returning({ id: householdMemberships.id });
    return updated.length > 0 ? 'updated' : 'stale';
  },

  /**
   * Ends a membership. Guarded: never removes the Owner — the Manager first moves
   * ownership with `swapOwner` (or dissolves the household with `delete`).
   *
   * @param householdId - The household.
   * @param userId - The member leaving or removed.
   * @returns `removed`, or `stale` (not a member, or the Owner).
   */
  removeMember: async (householdId: string, userId: string): Promise<Guarded<'removed'>> => {
    const removed = await db.delete(householdMemberships)
      .where(and(memberIs(householdId, userId), ne(householdMemberships.role, 'Owner')))
      .returning({ id: householdMemberships.id });
    return removed.length > 0 ? 'removed' : 'stale';
  },

  /**
   * Moves the Owner role from one member to another in one transaction: `from`
   * becomes Admin, `to` becomes Owner — never zero or two Owners (OQ-28).
   * Guarded: applies only while `from` is still the Owner and `to` is still a
   * member; otherwise nothing changes.
   *
   * @param householdId - The household.
   * @param fromUserId - The current Owner.
   * @param toUserId - The member who becomes Owner.
   * @returns `swapped`, or `stale`.
   */
  swapOwner: async (
    householdId: string,
    fromUserId: string,
    toUserId: string,
  ): Promise<Guarded<'swapped'>> => {
    try {
      await db.transaction(async (tx) => {
        const demoted = await tx.update(householdMemberships).set({ role: 'Admin' })
          .where(and(memberIs(householdId, fromUserId), eq(householdMemberships.role, 'Owner')))
          .returning({ id: householdMemberships.id });
        if (demoted.length === 0) tx.rollback();
        const promoted = await tx.update(householdMemberships)
          .set({ role: 'Owner' })
          .where(and(memberIs(householdId, toUserId), ne(householdMemberships.userId, fromUserId)))
          .returning({ id: householdMemberships.id });
        if (promoted.length === 0) tx.rollback();
      });
      return 'swapped';
    } catch (error) {
      if (error instanceof TransactionRollbackError) return 'stale';
      throw error;
    }
  },

  /**
   * Dissolves a household: everything household-scoped goes with it (FK cascade).
   *
   * @param householdId - The household.
   * @returns `true` when it existed.
   */
  delete: async (householdId: string): Promise<boolean> => (
    await db.delete(households).where(eq(households.id, householdId))
      .returning({ id: households.id })
  ).length > 0,
});

/** The HouseholdAccessor's operations. */
export type HouseholdAccessor = ReturnType<typeof createHouseholdAccessor>;

export default createHouseholdAccessor;
