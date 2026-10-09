import {
  describe, expect, it, vi,
} from 'vitest';
import type { Role } from '../../../../src/accessors/householdAccessor';
import { createAuthorizationUtility } from '../../../../src/utilities/authorization';

/**
 * Builds the utility over a membership lookup that answers with one role.
 *
 * @param role - The actor's role, or undefined for a non-member.
 * @returns The utility and the lookup spy.
 */
const setup = (role: Role | undefined) => {
  const findMembership = vi.fn(async () => role && { role });
  return { authz: createAuthorizationUtility({ findMembership }), findMembership };
};

describe('AuthorizationUtility', () => {
  it('reads the actor\'s role in that household and allows, returning the role', async () => {
    const { authz, findMembership } = setup('Admin');

    await expect(authz.authorize('u1', 'h1', { action: 'audit.export' }))
      .resolves.toEqual({ outcome: 'allowed', role: 'Admin' });
    expect(findMembership).toHaveBeenCalledWith('h1', 'u1');
  });

  it('answers not_member for someone outside the household', async () => {
    await expect(setup(undefined).authz.authorize('u1', 'h1', { action: 'household.view' }))
      .resolves.toEqual({ outcome: 'not_member' });
  });

  it('passes on forbidden and not_visible', async () => {
    const { authz } = setup('Viewer');
    const someoneElses = {
      action: 'data.view', visibility: 'personal', ownerUserId: 'u2',
    } as const;

    await expect(authz.authorize('u1', 'h1', { action: 'household.delete' }))
      .resolves.toEqual({ outcome: 'forbidden' });
    await expect(authz.authorize('u1', 'h1', someoneElses))
      .resolves.toEqual({ outcome: 'not_visible' });
  });
});
