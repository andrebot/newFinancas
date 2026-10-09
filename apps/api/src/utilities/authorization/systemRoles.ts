import type { SystemRole } from '../../db/schema/values';

// System roles (OQ-111): platform-wide, separate from household roles. Every
// user API requires USER and the future sys-admin pages ADMIN; ADMIN includes
// USER, so an admin also uses the app normally.

const RANK: Readonly<Record<SystemRole, number>> = { USER: 0, ADMIN: 1 };

/**
 * Tells whether a user's system role meets what an API requires.
 *
 * @param systemRole - The user's role, from their access token.
 * @param required - The role the API requires.
 * @returns Whether the user may call it.
 */
const hasSystemRole = (systemRole: SystemRole, required: SystemRole): boolean => (
  RANK[systemRole] >= RANK[required]
);

export default hasSystemRole;
