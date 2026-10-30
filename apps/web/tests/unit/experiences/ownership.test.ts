import { describe, expect, it } from 'vitest';
import {
  mayCreateOwned, mayManageOwned, mayShareOwned,
} from '../../../src/experiences/ownership';

// Who may create, share and manage a Budget or a Goal (BDT: Utility-like pure
// rule, unit; nothing mocked) — OQ-176, OQ-177, OQ-111.

describe('who may do what (OQ-176, OQ-177)', () => {
  it('lets every member create, but only non-Viewers share', () => {
    expect(mayCreateOwned('Viewer')).toBe(true);
    expect(mayCreateOwned(undefined)).toBe(false);
    expect(mayShareOwned('Member')).toBe(true);
    expect(mayShareOwned('Viewer')).toBe(false);
    expect(mayShareOwned(undefined)).toBe(false);
  });

  it('leaves a personal item to its owner, whatever their role', () => {
    const mine = { visibility: 'personal', ownerUserId: 'jane' } as const;
    expect(mayManageOwned(mine, 'jane', 'Viewer')).toBe(true);
    expect(mayManageOwned(mine, 'ben', 'Owner')).toBe(false);
  });

  it('lets an Owner or Admin manage a shared item, and a Member only their own', () => {
    const shared = { visibility: 'shared', ownerUserId: 'jane' } as const;
    expect(mayManageOwned(shared, 'ben', 'Owner')).toBe(true);
    expect(mayManageOwned(shared, 'ben', 'Admin')).toBe(true);
    expect(mayManageOwned(shared, 'jane', 'Member')).toBe(true);
    expect(mayManageOwned(shared, 'ben', 'Member')).toBe(false);
    expect(mayManageOwned(shared, 'jane', 'Viewer')).toBe(false);
    expect(mayManageOwned(shared, 'jane', undefined)).toBe(false);
  });

  it('leaves a shared item whose creator left to the Owner and Admins', () => {
    const orphan = { visibility: 'shared', ownerUserId: null } as const;
    expect(mayManageOwned(orphan, 'jane', 'Member')).toBe(false);
    expect(mayManageOwned(orphan, 'ben', 'Admin')).toBe(true);
  });
});
