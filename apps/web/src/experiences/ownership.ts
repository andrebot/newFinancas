// Who may create, share and manage a household's owned items — a Budget, a
// Goal, or an Account's transactions (OQ-176, OQ-177, OQ-220): the same rule
// everywhere, so the Flows of every Experience read it here rather than from
// each other (EBD: no sideways calls). A personal item is its owner's alone,
// whatever their role; a shared one follows the permission table — an Owner
// or Admin, or the Member who created it (OQ-111). The server checks again;
// this only decides what shows.

/** What an owned item carries that the rule reads. */
export interface OwnedItem {
  readonly visibility: 'personal' | 'shared';
  readonly ownerUserId?: string | null | undefined;
}

/**
 * Tells whether a role may create an item (FR-1.7): every member — a Viewer
 * too, as a personal item is its owner's whatever their role (OQ-194).
 *
 * @param role - The actor's role.
 * @returns Whether the Add button shows.
 */
export const mayCreateOwned = (role: string | undefined) => role !== undefined;

/**
 * Tells whether a role may create a shared item: everyone but a Viewer.
 *
 * @param role - The actor's role.
 * @returns Whether the create form offers Shared.
 */
export const mayShareOwned = (role: string | undefined) => (
  role !== undefined && role !== 'Viewer'
);

/**
 * Tells whether the actor may manage an item — edit and delete it, and complete
 * or reopen a Goal (OQ-176, OQ-177, OQ-111): a personal one only its owner; a
 * shared one an Owner/Admin, or the Member who created it.
 *
 * @param item - The item's visibility and owner.
 * @param selfUserId - The signed-in user's id.
 * @param role - Their role in the household.
 * @returns Whether its card offers the manage actions.
 */
export const mayManageOwned = (item: OwnedItem, selfUserId: string, role: string | undefined) => {
  if (!role) return false;
  if (item.visibility === 'personal') return item.ownerUserId === selfUserId;
  if (role === 'Owner' || role === 'Admin') return true;
  return role === 'Member' && item.ownerUserId === selfUserId;
};
