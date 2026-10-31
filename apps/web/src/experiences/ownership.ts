// Who may create, share and manage a household's owned items — a Budget, a
// Goal, or an Account's transactions (OQ-176, OQ-177, OQ-220, OQ-223): the same
// rule everywhere, so the Flows of every Experience read it here rather than
// from each other (EBD: no sideways calls). A personal item is its owner's
// alone, whatever their role; a shared one follows the permission table — an
// Owner or Admin, or the Member who created it (OQ-111); a transaction on a
// shared Account is its recorder's. The server checks again; this only decides
// what shows.

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

/**
 * Tells whether the actor may record on an Account (FR-1.7, OQ-223): a personal
 * one only its owner; a shared one anyone but a Viewer, whoever created it.
 *
 * @param account - The Account's visibility and owner.
 * @param selfUserId - The signed-in user's id.
 * @param role - Their role in the household.
 * @returns Whether money may be recorded there.
 */
export const mayRecordOn = (account: OwnedItem, selfUserId: string, role: string | undefined) => {
  if (!role) return false;
  if (account.visibility === 'personal') return account.ownerUserId === selfUserId;
  return role !== 'Viewer';
};

/**
 * Tells whether the actor may edit and delete a transaction (OQ-223): on a
 * personal Account only its owner, whoever recorded it; on a shared one an
 * Owner/Admin, or the Member who recorded it — a schedule post, recorded by no
 * one, is an Owner's or Admin's.
 *
 * @param account - The transaction's Account: its visibility and owner.
 * @param recorderUserId - Who recorded the transaction; none for a schedule post.
 * @param selfUserId - The signed-in user's id.
 * @param role - Their role in the household.
 * @returns Whether the row offers Edit and Delete.
 */
export const mayManageRecorded = (
  account: OwnedItem,
  recorderUserId: string | null | undefined,
  selfUserId: string,
  role: string | undefined,
) => mayManageOwned(
  account.visibility === 'shared' ? { visibility: 'shared', ownerUserId: recorderUserId } : account,
  selfUserId,
  role,
);
