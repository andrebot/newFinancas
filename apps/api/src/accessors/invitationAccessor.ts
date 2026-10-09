import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '../db/database';
import { PG_FOREIGN_KEY_VIOLATION, pgErrorCode } from '../db/errors';
import { households, invitations, users } from '../db/schema';
import type { AssignableRole } from './householdAccessor';

// InvitationAccessor (A4, VBD): household invitations and their lifecycle,
// pending → accepted | declined | revoked (FR-1.10). Applies data changes only:
// who may invite, accept or revoke — and that the invitee must be a registered
// user (FR-1.19) — is IdentityManager's decision (OQ-107, OQ-109).

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';
export type Resolution = Exclude<InvitationStatus, 'pending'>;

export interface Invitation {
  readonly id: string;
  readonly householdId: string;
  readonly invitedUserId: string;
  /** Null once the inviter's account is deleted (FR-1.17). */
  readonly invitedByUserId: string | null;
  readonly role: AssignableRole;
  readonly status: InvitationStatus;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

/** A pending invitation as its invitee sees it (FR-1.10: which household, who sent it). */
export interface ReceivedInvitation {
  readonly id: string;
  readonly householdId: string;
  readonly householdName: string;
  readonly role: AssignableRole;
  readonly invitedByUserId: string | null;
  /** Null when the inviter's account was deleted — the app shows "Someone" (OQ-82). */
  readonly inviterFirstName: string | null;
  readonly inviterLastName: string | null;
  readonly createdAt: Date;
}

export type InsertInvitationResult = | { readonly ok: true; readonly invitation: Invitation }
  /** The invited user no longer exists (removed since the Manager looked them up). */
  | { readonly ok: false; readonly reason: 'invitee_missing' };

const columns = {
  id: invitations.id,
  householdId: invitations.householdId,
  invitedUserId: invitations.invitedUserId,
  invitedByUserId: invitations.invitedByUserId,
  role: invitations.role,
  status: invitations.status,
  createdAt: invitations.createdAt,
  resolvedAt: invitations.resolvedAt,
};

const inviter = alias(users, 'inviter');

/**
 * Builds the InvitationAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createInvitationAccessor = (db: Database) => ({
  /**
   * Records a pending invitation. The invitee is a user ID the Manager resolved
   * from the email; the NOT NULL foreign key guarantees it exists (FR-1.19).
   *
   * @param invitation - Household, invitee, inviter and offered role.
   * @param invitation.householdId - The household.
   * @param invitation.invitedUserId - The invitee.
   * @param invitation.invitedByUserId - The inviter.
   * @param invitation.role - The offered role.
   * @returns The invitation, or `invitee_missing`.
   */
  insert: async (invitation: {
    householdId: string; invitedUserId: string; invitedByUserId: string; role: AssignableRole;
  }): Promise<InsertInvitationResult> => {
    try {
      const [row] = await db.transaction((tx) => tx.insert(invitations).values(invitation)
        .returning(columns));
      return { ok: true, invitation: row as Invitation };
    } catch (error) {
      if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
        return { ok: false, reason: 'invitee_missing' };
      }
      throw error;
    }
  },

  /**
   * Reads one invitation (the Manager checks who may act on it).
   *
   * @param invitationId - The invitation.
   * @returns It, or `undefined`.
   */
  findById: async (invitationId: string): Promise<Invitation | undefined> => {
    const [row] = await db.select(columns).from(invitations)
      .where(eq(invitations.id, invitationId));
    return row as Invitation | undefined;
  },

  /**
   * Finds a pending invitation of a user to a household (the Manager's duplicate check).
   *
   * @param householdId - The household.
   * @param invitedUserId - The invitee.
   * @returns The pending invitation, or `undefined`.
   */
  findPending: async (
    householdId: string,
    invitedUserId: string,
  ): Promise<Invitation | undefined> => {
    const [row] = await db.select(columns).from(invitations).where(and(
      eq(invitations.householdId, householdId),
      eq(invitations.invitedUserId, invitedUserId),
      eq(invitations.status, 'pending'),
    ));
    return row as Invitation | undefined;
  },

  /**
   * Lists the pending invitations a user received, with household and inviter
   * names (read-only joins), newest first.
   *
   * @param userId - The invitee.
   * @returns The invitations.
   */
  listPendingForUser: async (userId: string): Promise<ReceivedInvitation[]> => (
    await db.select({
      id: invitations.id,
      householdId: invitations.householdId,
      householdName: households.name,
      role: invitations.role,
      invitedByUserId: invitations.invitedByUserId,
      inviterFirstName: inviter.firstName,
      inviterLastName: inviter.lastName,
      createdAt: invitations.createdAt,
    }).from(invitations)
      .innerJoin(households, eq(households.id, invitations.householdId))
      .leftJoin(inviter, eq(inviter.id, invitations.invitedByUserId))
      .where(and(eq(invitations.invitedUserId, userId), eq(invitations.status, 'pending')))
      .orderBy(desc(invitations.createdAt), desc(invitations.id))
  ) as ReceivedInvitation[],

  /**
   * Lists every invitation of a household, newest first.
   *
   * @param householdId - The household.
   * @returns The invitations, all statuses.
   */
  listForHousehold: async (householdId: string): Promise<Invitation[]> => (
    await db.select(columns).from(invitations)
      .where(eq(invitations.householdId, householdId))
      .orderBy(desc(invitations.createdAt), desc(invitations.id))
  ) as Invitation[],

  /**
   * Resolves an invitation as accepted, declined or revoked. Guarded: applies only
   * while it is still pending, so two resolutions can't both win (FR-1.10).
   *
   * @param invitationId - The invitation.
   * @param resolution - The outcome.
   * @param now - When it was resolved.
   * @returns `resolved`, or `stale` (missing or no longer pending → 409).
   */
  resolve: async (
    invitationId: string,
    resolution: Resolution,
    now: Date,
  ): Promise<'resolved' | 'stale'> => {
    const resolved = await db.update(invitations).set({ status: resolution, resolvedAt: now })
      .where(and(eq(invitations.id, invitationId), eq(invitations.status, 'pending')))
      .returning({ id: invitations.id });
    return resolved.length > 0 ? 'resolved' : 'stale';
  },
});

/** The InvitationAccessor's operations. */
export type InvitationAccessor = ReturnType<typeof createInvitationAccessor>;

export default createInvitationAccessor;
