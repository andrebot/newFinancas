import { describe, expect, it } from 'vitest';
import type { Role } from '../../../../src/accessors/householdAccessor';
import { decide } from '../../../../src/utilities/authorization';

const ME = 'u-me';
const OTHER = 'u-other';

describe('decide — household actions (FR-1.7, FR-1.11/12, FR-1.20, FR-7.2)', () => {
  it.each([
    ['household.view', ['Owner', 'Admin', 'Member', 'Viewer'], []],
    ['household.delete', ['Owner'], ['Admin', 'Member', 'Viewer']],
    ['household.transferOwnership', ['Owner'], ['Admin', 'Member', 'Viewer']],
    ['members.manage', ['Owner', 'Admin'], ['Member', 'Viewer']],
    ['audit.export', ['Owner', 'Admin'], ['Member', 'Viewer']],
  ] as const)('%s: allowed for %j, forbidden for %j', (action, allowed, denied) => {
    allowed.forEach((role) => expect(decide(role, ME, { action })).toBe('allowed'));
    denied.forEach((role) => expect(decide(role, ME, { action })).toBe('forbidden'));
  });
});

describe('decide — personal data (FR-2.3, OQ-111)', () => {
  const ROLES: readonly Role[] = ['Owner', 'Admin', 'Member', 'Viewer'];

  it.each([
    'data.view', 'data.create', 'data.edit', 'data.delete',
  ] as const)('%s on your own: every role', (action) => {
    ROLES.forEach((role) => {
      expect(decide(role, ME, { action, visibility: 'personal', ownerUserId: ME })).toBe('allowed');
    });
  });

  it.each([
    'data.view', 'data.edit', 'data.delete',
  ] as const)('%s on another\'s: hidden, even from Owner', (action) => {
    ROLES.forEach((role) => {
      expect(decide(role, ME, { action, visibility: 'personal', ownerUserId: OTHER }))
        .toBe('not_visible');
    });
  });
});

describe('decide — shared data (FR-1.7)', () => {
  it.each([
    ['data.view', 'Viewer', OTHER, 'allowed'],
    ['data.create', 'Member', ME, 'allowed'],
    ['data.create', 'Viewer', ME, 'forbidden'],
    ['data.edit', 'Admin', OTHER, 'allowed'],
    ['data.edit', 'Owner', null, 'allowed'],
    ['data.edit', 'Member', ME, 'allowed'],
    ['data.edit', 'Member', OTHER, 'forbidden'],
    ['data.edit', 'Member', null, 'forbidden'],
    ['data.edit', 'Viewer', ME, 'forbidden'],
    ['data.delete', 'Admin', OTHER, 'allowed'],
    ['data.delete', 'Member', ME, 'allowed'],
    ['data.delete', 'Member', OTHER, 'forbidden'],
    ['data.delete', 'Viewer', ME, 'forbidden'],
  ] as const)('%s by a %s on data created by %s: %s', (action, role, ownerUserId, decision) => {
    expect(decide(role, ME, { action, visibility: 'shared', ownerUserId })).toBe(decision);
  });
});
