import {
  fullName, sortMembers, type HouseholdMember,
} from '../flows/membershipManagement/membershipState';

// What leaving the household costs, as Leave Household says it (X4, OQ-160).
// It depends only on who is leaving and who stays: anyone but the Owner just
// loses access; an Owner hands the household on by FR-1.18's succession — the
// longest-tenured Admin, else Member, else Viewer, which is the members list's
// own order — or, alone, takes it with them. The API decides for real; this
// only names the outcome beforehand.

/** What leaving does. */
export type LeaveConsequence = { readonly kind: 'member' }
  | { readonly kind: 'successor'; readonly name: string }
  | { readonly kind: 'last' };

/**
 * Says what leaving the household does.
 *
 * @param members - The household's members.
 * @param selfUserId - Who is leaving.
 * @returns `member` for anyone but the Owner; for the Owner, who takes over,
 *   or `last` when no one else remains.
 */
export const leaveConsequence = (
  members: readonly HouseholdMember[],
  selfUserId: string,
): LeaveConsequence => {
  const isOwner = members.some(({ userId, role }) => userId === selfUserId && role === 'Owner');
  if (!isOwner) return { kind: 'member' };
  const successor = sortMembers(members).find(({ userId }) => userId !== selfUserId);
  return successor ? { kind: 'successor', name: fullName(successor) } : { kind: 'last' };
};
