import {
  describe, expect, it, vi,
} from 'vitest';
import { createDomainError } from '../../../src/utilities/domainError';
import {
  accessToOwned, forbidden, householdNotFound, memberOnly, requireAccess,
} from '../../../src/managers/access';

const REQUEST = { action: 'data.edit', visibility: 'personal', ownerUserId: 'u2' } as const;

/**
 * An AuthorizationUtility answering with one outcome.
 *
 * @param result - What `authorize` resolves to.
 * @returns The mock.
 */
const authorizing = (result: unknown) => ({ authorize: vi.fn(async () => result) }) as never;

describe('requireAccess', () => {
  it('returns the role when allowed, asking about the actor, household and request', async () => {
    const authorization = authorizing({ outcome: 'allowed', role: 'Admin' });

    await expect(requireAccess(authorization, 'u1', 'h1', REQUEST)).resolves.toBe('Admin');
    expect((authorization as { authorize: unknown }).authorize)
      .toHaveBeenCalledWith('u1', 'h1', REQUEST);
  });

  it('answers a non-member 404 household.not_found', async () => {
    await expect(requireAccess(authorizing({ outcome: 'not_member' }), 'u1', 'h1', REQUEST))
      .rejects.toMatchObject({ domainError: { code: 'household.not_found' } });
  });

  it('answers a member without the role 403 auth.forbidden', async () => {
    await expect(requireAccess(authorizing({ outcome: 'forbidden' }), 'u1', 'h1', REQUEST))
      .rejects.toMatchObject({ domainError: { code: 'auth.forbidden' } });
  });

  it('answers someone else\'s personal data with the entity\'s 404', async () => {
    const notVisible = () => createDomainError({
      code: 'category.not_found', message: 'x',
    });

    await expect(requireAccess(
      authorizing({ outcome: 'not_visible' }),
      'u1',
      'h1',
      REQUEST,
      notVisible,
    )).rejects.toMatchObject({ domainError: { code: 'category.not_found' } });
  });

  it('falls back to the household\'s 404 when no entity 404 is given', async () => {
    await expect(requireAccess(authorizing({ outcome: 'not_visible' }), 'u1', 'h1', REQUEST))
      .rejects.toMatchObject({ domainError: { code: 'household.not_found' } });
  });
});

describe('the shared answers', () => {
  it('are 404 household.not_found and 403 auth.forbidden', () => {
    expect(householdNotFound().domainError)
      .toMatchObject({ code: 'household.not_found' });
    expect(forbidden().domainError).toMatchObject({ code: 'auth.forbidden' });
  });
});

describe('accessToOwned', () => {
  it('asks about the action on the data\'s visibility and owner', () => {
    expect(accessToOwned({ visibility: 'personal', ownerUserId: 'u2' }, 'data.delete'))
      .toEqual({ action: 'data.delete', visibility: 'personal', ownerUserId: 'u2' });
  });

  it('asks only for membership when the data isn\'t there', () => {
    expect(accessToOwned(undefined, 'data.edit')).toBe(memberOnly);
  });
});

describe('memberOnly', () => {
  it('is a view of shared data nobody owns: what every member may do', () => {
    expect(memberOnly).toEqual({ action: 'data.view', visibility: 'shared', ownerUserId: null });
  });
});
