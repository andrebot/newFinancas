// What a log event is made of (U2, NFR-OBS-1/2). Shared by the console format,
// the file, the audit sink and reconciliation.

/** Who caused an event: a user, or an explicit marker when there is none (NFR-OBS-2). */
export type Actor = { readonly userId: string } | 'system' | 'unauthenticated';

/**
 * Renders an actor for log lines.
 *
 * @param actor - The actor.
 * @returns `user:<id>`, `system` or `unauthenticated`.
 */
export const actorLabel = (actor: Actor): string => (
  typeof actor === 'string' ? actor : `user:${actor.userId}`
);

/**
 * The actor's user ID for the audit record.
 *
 * @param actor - The actor.
 * @returns The user ID, or `null` for system/unauthenticated actions.
 */
export const actorUserId = (actor: Actor): string | null => (
  typeof actor === 'string' ? null : actor.userId
);
