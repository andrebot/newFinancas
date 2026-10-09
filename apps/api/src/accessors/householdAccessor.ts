import {
  and, asc, eq, sql,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '../db/errors';
import { householdMemberships, households, users } from '../db/schema';
import type { ROLES } from '../db/schema/values';

// HouseholdAccessor (A3, VBD): households and memberships. Enforces the
// membership rules as part of its writes (OQ-107): exactly one Owner (FR-1.18,
// OQ-28 — also a unique index), the Owner leaves only by their own action
// (FR-1.11), succession on the Owner's departure, atomic ownership transfer.

export type Role = (typeof ROLES)[number];
/** Roles a member can be given; Owner moves only by transfer or succession. */
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

export type AddMemberResult = 'added' | 'already_member';
export type UpdateRoleResult = 'updated' | 'not_member' | 'is_owner';
export type TransferResult = 'transferred' | 'not_owner' | 'target_not_member';

/** What removing or leaving did (FR-1.11, FR-1.18). */
export type TransitionResult = | { readonly status: 'removed' }
  | { readonly status: 'removed'; readonly promotedUserId: string }
  | { readonly status: 'household_deleted' }
  | { readonly status: 'not_member' }
  /** Someone other than the Owner tried to remove the Owner. */
  | { readonly status: 'owner_protected' };

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

/** Succession order (FR-1.18): Admin, then Member, then Viewer. */
const SUCCESSION_RANK = sql`CASE ${householdMemberships.role}
  WHEN 'Admin' THEN 1 WHEN 'Member' THEN 2 ELSE 3 END`;

/**
 * Locks a household's memberships for the rest of the transaction and returns
 * them in succession order, so concurrent changes can't race a decision.
 *
 * @param tx - An open transaction.
 * @param householdId - The household.
 * @returns Its memberships: successors first, longest-tenured first.
 */
const lockMembers = (tx: Database, householdId: string) => tx.select({
  userId: householdMemberships.userId,
  role: householdMemberships.role,
}).from(householdMemberships)
  .where(eq(householdMemberships.householdId, householdId))
  .orderBy(SUCCESSION_RANK, asc(householdMemberships.joinedAt), asc(householdMemberships.id))
  .for('update');

/**
 * Removes the Owner, promoting the next member or dissolving the household (FR-1.18).
 *
 * @param tx - An open transaction holding the membership lock.
 * @param householdId - The household.
 * @param ownerId - The departing Owner.
 * @param successorId - The first in succession order other than the Owner, if any.
 * @returns What happened.
 */
const removeOwner = async (
  tx: Database,
  householdId: string,
  ownerId: string,
  successorId: string | undefined,
): Promise<TransitionResult> => {
  if (successorId === undefined) {
    await tx.delete(households).where(eq(households.id, householdId));
    return { status: 'household_deleted' };
  }
  await tx.delete(householdMemberships).where(memberIs(householdId, ownerId));
  await tx.update(householdMemberships).set({ role: 'Owner' })
    .where(memberIs(householdId, successorId));
  return { status: 'removed', promotedUserId: successorId };
};

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
   * Reads a user's role in a household (AuthorizationUtility's input).
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
   * @returns Members, Owner first, then by succession order.
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
  ): Promise<AddMemberResult> => {
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
   * Changes a member's role among Admin, Member and Viewer; never the Owner's (FR-1.12).
   *
   * @param householdId - The household.
   * @param userId - The member.
   * @param role - The new role.
   * @returns `updated`, `not_member`, or `is_owner` (nothing changed).
   */
  updateRole: (
    householdId: string,
    userId: string,
    role: AssignableRole,
  ): Promise<UpdateRoleResult> => (
    db.transaction(async (tx) => {
      const current = (await lockMembers(tx, householdId)).find((m) => m.userId === userId);
      if (!current) return 'not_member';
      if (current.role === 'Owner') return 'is_owner';
      await tx.update(householdMemberships).set({ role }).where(memberIs(householdId, userId));
      return 'updated';
    })
  ),

  /**
   * Removes a member or lets them leave (FR-1.11). The Owner can only leave by
   * their own action; when they do, the longest-tenured Admin (else Member, else
   * Viewer) becomes Owner in the same transaction, or the household is deleted
   * if nobody remains (FR-1.18).
   *
   * @param householdId - The household.
   * @param userId - Who leaves or is removed.
   * @param actorId - Who is doing it (equal to `userId` when leaving).
   * @returns What happened.
   */
  transitionMembership: (
    householdId: string,
    userId: string,
    actorId: string,
  ): Promise<TransitionResult> => (
    db.transaction(async (tx) => {
      const members = await lockMembers(tx, householdId);
      const target = members.find((m) => m.userId === userId);
      if (!target) return { status: 'not_member' };
      if (target.role !== 'Owner') {
        await tx.delete(householdMemberships).where(memberIs(householdId, userId));
        return { status: 'removed' };
      }
      if (actorId !== userId) return { status: 'owner_protected' };
      return removeOwner(tx, householdId, userId, members.find((m) => m.userId !== userId)?.userId);
    })
  ),

  /**
   * Hands ownership to another member atomically: the Owner becomes Admin, the
   * target becomes Owner, in one transaction — never zero or two Owners (FR-1.20, OQ-28).
   *
   * @param householdId - The household.
   * @param ownerId - The current Owner.
   * @param targetUserId - The member who becomes Owner.
   * @returns `transferred`, `not_owner`, or `target_not_member`.
   */
  transferOwnership: (
    householdId: string,
    ownerId: string,
    targetUserId: string,
  ): Promise<TransferResult> => (
    db.transaction(async (tx) => {
      const members = await lockMembers(tx, householdId);
      if (members.find((m) => m.userId === ownerId)?.role !== 'Owner') return 'not_owner';
      if (targetUserId === ownerId || !members.some((m) => m.userId === targetUserId)) {
        return 'target_not_member';
      }
      const setRole = (userId: string, role: Role) => tx.update(householdMemberships).set({ role })
        .where(memberIs(householdId, userId));
      await setRole(ownerId, 'Admin');
      await setRole(targetUserId, 'Owner');
      return 'transferred';
    })
  ),

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
