import { household } from '../../config/constants';

// The members' order (X4, OQ-160; code review A4, OQ-163): the Owner first,
// then by role, then the longest-tenured — which is also FR-1.18's succession
// order. The Membership Management Flow lists members this way and Leave
// Household names the successor from it, so it is the Experience's, not the
// Flow's.

/** A household role (FR-1.6), in the settings' order. */
type Role = (typeof household.roleOrder)[number];

/** What ordering needs to know about a member. */
export interface Ordered {
  readonly role: Role;
  /** ISO time they joined. */
  readonly joinedAt: string;
}

/**
 * Orders the members: the Owner first, then by role, then the longest-tenured.
 *
 * @param members - The members as the API listed them.
 * @returns A sorted copy.
 */
export const sortMembers = <Member extends Ordered>(
  members: readonly Member[],
): readonly Member[] => [...members].sort((left, right) => (
  household.roleOrder.indexOf(left.role) - household.roleOrder.indexOf(right.role)
  || left.joinedAt.localeCompare(right.joinedAt)
));
