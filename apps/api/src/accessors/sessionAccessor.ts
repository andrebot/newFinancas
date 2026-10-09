import {
  and, desc, eq, gt, ne,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { sessions } from '../db/schema';

// SessionAccessor (A2, VBD): one row per signed-in device, backed by its refresh
// token (OQ-30). Stores only token hashes and applies data changes; what to do
// about a replayed refresh token is IdentityManager's decision (OQ-107/OQ-108).

/** A signed-in device, as the sessions list shows it. */
export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly deviceInfo: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly expiresAt: Date;
}

/** A guarded rotation: applied, or the token is not a session's current, unexpired one. */
export type RotateResult = | { readonly status: 'rotated'; readonly session: Session }
  | { readonly status: 'stale' };

const columns = {
  id: sessions.id,
  userId: sessions.userId,
  deviceInfo: sessions.deviceInfo,
  createdAt: sessions.createdAt,
  lastUsedAt: sessions.lastUsedAt,
  expiresAt: sessions.expiresAt,
};

/**
 * Builds the SessionAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createSessionAccessor = (db: Database) => ({
  /**
   * Opens a session for a sign-in.
   *
   * @param userId - Who signed in.
   * @param refreshTokenHash - Hash of the refresh token given to the device.
   * @param deviceInfo - Shown in the sessions list (e.g. browser and OS).
   * @param expiresAt - When the refresh token stops working.
   * @returns The session; its ID goes into the access token (`sid`).
   */
  insert: async (
    userId: string,
    refreshTokenHash: string,
    deviceInfo: string | null,
    expiresAt: Date,
  ): Promise<Session> => {
    const [row] = await db.insert(sessions)
      .values({
        userId, refreshTokenHash, deviceInfo, expiresAt,
      })
      .returning(columns);
    return row!;
  },

  /**
   * Replaces a session's refresh token, atomically. Guarded: applies only while
   * the presented token is still the session's current one and unexpired;
   * otherwise nothing changes. The replaced token is remembered (OQ-106).
   *
   * @param presentedHash - Hash of the token the device sent.
   * @param newHash - Hash of the replacement token.
   * @param expiresAt - New expiry (sliding).
   * @param now - Current time.
   * @returns `rotated` with the session, or `stale`.
   */
  rotate: async (
    presentedHash: string,
    newHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<RotateResult> => {
    const [rotated] = await db.update(sessions)
      .set({
        previousRefreshTokenHash: presentedHash,
        refreshTokenHash: newHash,
        expiresAt,
        lastUsedAt: now,
      })
      .where(and(eq(sessions.refreshTokenHash, presentedHash), gt(sessions.expiresAt, now)))
      .returning(columns);
    return rotated ? { status: 'rotated', session: rotated } : { status: 'stale' };
  },

  /**
   * Finds the session whose last rotation replaced this token — a fact the
   * Manager uses to recognise a replayed (likely stolen) refresh token (OQ-100).
   *
   * @param tokenHash - Hash of the token presented.
   * @returns The session's id and owner, or `undefined`.
   */
  findByReplacedToken: async (tokenHash: string) => {
    const [row] = await db.select({ id: sessions.id, userId: sessions.userId }).from(sessions)
      .where(eq(sessions.previousRefreshTokenHash, tokenHash));
    return row;
  },

  /**
   * Lists a user's active sessions, most recently used first; expired ones are left out.
   *
   * @param userId - Whose sessions.
   * @param now - Current time.
   * @returns The sessions.
   */
  listByUser: async (userId: string, now: Date): Promise<Session[]> => db.select(columns)
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastUsedAt), desc(sessions.id)),

  /**
   * Ends one of a user's sessions — logout (the current one) or revoking another
   * device. Ownership check and delete in one statement (OQ-106).
   *
   * @param userId - Whose session.
   * @param sessionId - Which one.
   * @returns `true` when ended; `false` when missing or someone else's (both → 404).
   */
  deleteForUser: async (userId: string, sessionId: string): Promise<boolean> => {
    const deleted = await db.delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .returning({ id: sessions.id });
    return deleted.length > 0;
  },

  /**
   * Ends every session of a user (password reset, account deletion).
   *
   * @param userId - Whose sessions.
   * @returns How many were ended.
   */
  deleteAllForUser: async (userId: string): Promise<number> => (
    await db.delete(sessions).where(eq(sessions.userId, userId)).returning({ id: sessions.id })
  ).length,

  /**
   * Ends every session of a user except the current one ("sign out all others",
   * change password — FR-1.3, OQ-62).
   *
   * @param userId - Whose sessions.
   * @param currentSessionId - The session to keep.
   * @returns How many were ended.
   */
  deleteAllExceptCurrent: async (userId: string, currentSessionId: string): Promise<number> => (
    await db.delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
      .returning({ id: sessions.id })
  ).length,
});

/** The SessionAccessor's operations. */
export type SessionAccessor = ReturnType<typeof createSessionAccessor>;

export default createSessionAccessor;
