import { describe, expect, it } from 'vitest';
import type {
  HouseholdMember,
} from '../../../../../src/experiences/manageHousehold/flows/membershipManagement/membershipState';
import {
  leaveConsequence,
} from '../../../../../src/experiences/manageHousehold/interactions/leaveConsequence';

// Pure rule (BDT: unit, nothing mocked): what leaving does, by FR-1.18.

/**
 * Builds a member.
 *
 * @param userId - Their id, also their first name.
 * @param role - Their role.
 * @param joinedAt - When they joined.
 * @returns The member.
 */
const member = (
  userId: string,
  role: HouseholdMember['role'],
  joinedAt: string,
): HouseholdMember => ({
  userId, firstName: userId, lastName: 'Doe', email: `${userId}@example.com`, role, joinedAt,
});

const JANE = member('Jane', 'Owner', '2024-01-01T00:00:00Z');

describe('leaveConsequence', () => {
  it('is a plain loss of access for anyone but the Owner', () => {
    const sam = member('Sam', 'Member', '2025-06-01T00:00:00Z');

    expect(leaveConsequence([JANE, sam], 'Sam')).toEqual({ kind: 'member' });
  });

  it('treats a user missing from the list as a plain member', () => {
    expect(leaveConsequence([JANE], 'Nobody')).toEqual({ kind: 'member' });
  });

  it('names the longest-tenured Admin as the Owner’s successor', () => {
    const members = [
      JANE,
      member('Priya', 'Viewer', '2024-02-01T00:00:00Z'),
      member('Sam', 'Member', '2024-03-01T00:00:00Z'),
      member('Morgan', 'Admin', '2025-01-01T00:00:00Z'),
      member('Alex', 'Admin', '2024-06-01T00:00:00Z'),
    ];

    expect(leaveConsequence(members, 'Jane')).toEqual({ kind: 'successor', name: 'Alex Doe' });
  });

  it('falls back to a Member, then a Viewer', () => {
    const priya = member('Priya', 'Viewer', '2024-02-01T00:00:00Z');
    const sam = member('Sam', 'Member', '2025-03-01T00:00:00Z');

    expect(leaveConsequence([JANE, priya, sam], 'Jane'))
      .toEqual({ kind: 'successor', name: 'Sam Doe' });
    expect(leaveConsequence([priya, JANE], 'Jane'))
      .toEqual({ kind: 'successor', name: 'Priya Doe' });
  });

  it('says the household goes with an Owner who is alone', () => {
    expect(leaveConsequence([JANE], 'Jane')).toEqual({ kind: 'last' });
  });
});
