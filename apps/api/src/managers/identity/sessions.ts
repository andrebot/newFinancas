import type { IdentityDeps, SignedInContext } from './context';
import { loggerFor } from './context';
import { sessionNotFound } from './errors';

// View Sessions (uc-16) and Revoke Session(s) (uc-17), NFR-SEC-5: a user sees
// their signed-in devices and can end any of them, or every one but this.

/** A signed-in device as the sessions list shows it. */
export interface SessionView {
  readonly id: string;
  readonly deviceInfo: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  /** The device making this request. */
  readonly current: boolean;
}

/**
 * Builds the session use cases.
 *
 * @param deps - The tier below.
 * @returns `listSessions`, `revokeSession`, `revokeOtherSessions`.
 */
const createSessions = (deps: IdentityDeps) => ({
  /**
   * Lists the caller's active sessions, most recently used first (uc-16).
   *
   * @param context - The signed-in request.
   * @returns The sessions, the current one flagged.
   */
  listSessions: async (context: SignedInContext): Promise<SessionView[]> => {
    const { userId, sessionId } = context.actor;
    const active = await deps.sessions.listByUser(userId, deps.now());
    return active.map((session) => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      current: session.id === sessionId,
    }));
  },

  /**
   * Ends one of the caller's sessions (uc-17).
   *
   * @param context - The signed-in request.
   * @param sessionId - The session to end.
   * @throws {ApiError} 404 `session.not_found` when missing or someone else's.
   */
  revokeSession: async (context: SignedInContext, sessionId: string): Promise<void> => {
    const ended = await deps.sessions.deleteForUser(context.actor.userId, sessionId);
    if (!ended) throw sessionNotFound();
    loggerFor(context).info('Session revoked', { sessionId });
  },

  /**
   * Ends every session but the current one — "sign out all others" (uc-17).
   *
   * @param context - The signed-in request.
   */
  revokeOtherSessions: async (context: SignedInContext): Promise<void> => {
    const { userId, sessionId } = context.actor;
    const ended = await deps.sessions.deleteAllExceptCurrent(userId, sessionId);
    loggerFor(context).info('Other sessions revoked', { ended });
  },
});

export default createSessions;
