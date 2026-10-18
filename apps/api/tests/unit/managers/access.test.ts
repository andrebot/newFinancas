import {
  describe, expect, it, vi,
} from 'vitest';
import { createApiError } from '../../../src/http/apiError';
import {
  accessToOwned, forbidden, householdNotFound, requireAccess,
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
      .rejects.toMatchObject({ apiError: { status: 404, code: 'household.not_found' } });
  });

  it('answers a member without the role 403 auth.forbidden', async () => {
    await expect(requireAccess(authorizing({ outcome: 'forbidden' }), 'u1', 'h1', REQUEST))
      .rejects.toMatchObject({ apiError: { status: 403, code: 'auth.forbidden' } });
  });

  it('answers someone else\'s personal data with the entity\'s 404', async () => {
    const notVisible = () => createApiError({
      status: 404, code: 'category.not_found', message: 'x',
    });

    await expect(requireAccess(
      authorizing({ outcome: 'not_visible' }),
      'u1',
      'h1',
      REQUEST,
      notVisible,
    )).rejects.toMatchObject({ apiError: { code: 'category.not_found' } });
  });

  it('falls back to the household\'s 404 when no entity 404 is given', async () => {
    await expect(requireAccess(authorizing({ outcome: 'not_visible' }), 'u1', 'h1', REQUEST))
      .rejects.toMatchObject({ apiError: { code: 'household.not_found' } });
  });
});

describe('the shared answers', () => {
  it('are 404 household.not_found and 403 auth.forbidden', () => {
    expect(householdNotFound().apiError)
      .toMatchObject({ status: 404, code: 'household.not_found' });
    expect(forbidden().apiError).toMatchObject({ status: 403, code: 'auth.forbidden' });
  });
});

describe('accessToOwned', () => {
  it('asks about the action on the data\'s visibility and owner', () => {
    expect(accessToOwned({ visibility: 'personal', ownerUserId: 'u2' }, 'data.delete'))
      .toEqual({ action: 'data.delete', visibility: 'personal', ownerUserId: 'u2' });
  });

  it('asks only for membership when the data isn\'t there', () => {
    expect(accessToOwned(undefined, 'data.edit'))
      .toEqual({ action: 'data.view', visibility: 'shared', ownerUserId: null });
  });
});
