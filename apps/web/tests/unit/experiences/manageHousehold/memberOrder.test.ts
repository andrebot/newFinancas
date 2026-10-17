import { describe, expect, it } from 'vitest';
import { sortMembers } from '../../../../src/experiences/manageHousehold/memberOrder';

// The members' order (BDT: unit, pure — nothing to mock).

/**
 * Builds a member as ordering sees it.
 *
 * @param id - Who.
 * @param role - Their role.
 * @param joinedAt - When they joined.
 * @returns The member.
 */
const member = (id: string, role: 'Owner' | 'Admin' | 'Member' | 'Viewer', joinedAt: string) => ({
  id, role, joinedAt,
});

describe('sortMembers', () => {
  it('puts the Owner first, then by role, then the longest-tenured first', () => {
    const members = [
      member('priya', 'Viewer', '2026-02-01T00:00:00Z'),
      member('new', 'Admin', '2026-09-01T00:00:00Z'),
      member('sam', 'Member', '2025-06-01T00:00:00Z'),
      member('alex', 'Admin', '2024-03-01T00:00:00Z'),
      member('jane', 'Owner', '2024-01-01T00:00:00Z'),
    ];

    expect(sortMembers(members).map(({ id }) => id))
      .toEqual(['jane', 'alex', 'new', 'sam', 'priya']);
  });

  it('leaves the list it was given alone', () => {
    const members = [
      member('b', 'Viewer', '2026-01-01T00:00:00Z'),
      member('a', 'Owner', '2025-01-01T00:00:00Z'),
    ];

    sortMembers(members);

    expect(members.map(({ id }) => id)).toEqual(['b', 'a']);
  });
});
