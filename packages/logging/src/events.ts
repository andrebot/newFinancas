// Who caused an event (U2, NFR-OBS-2): every event carries an actor label.

/** Who caused an event: a user, or an explicit marker when there is none. */
export type Actor = { readonly userId: string } | 'system' | 'unauthenticated';

/**
 * Renders an actor as the `actor` context of a child logger.
 *
 * @param actor - The actor.
 * @returns `user:<id>`, `system` or `unauthenticated`.
 */
export const actorLabel = (actor: Actor): string => (
  typeof actor === 'string' ? actor : `user:${actor.userId}`
);

/**
 * Reads the user ID back out of an actor label (for the audit record).
 *
 * @param label - An actor label, if any.
 * @returns The user ID, or `null` for system/unauthenticated/unknown actors.
 */
export const userIdFromActor = (label: unknown): string | null => (
  typeof label === 'string' && label.startsWith('user:') ? label.slice('user:'.length) : null
);
