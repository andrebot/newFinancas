import { describe, expect, it } from 'vitest';
import {
  mayCreateOwned, mayManageOwned, mayManageRecorded, mayShareOwned,
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
    // Not before the role is known (review V9).
    expect(mayManageOwned(mine, 'jane', undefined)).toBe(false);
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

describe('who may change transactions (OQ-223)', () => {
  it("gives a shared account's transaction to its recorder, a schedule post to Owner/Admin", () => {
    const shared = { visibility: 'shared', ownerUserId: 'jane' } as const;
    expect(mayManageRecorded(shared, 'ben', 'ben', 'Member')).toBe(true);
    expect(mayManageRecorded(shared, 'ben', 'jane', 'Member')).toBe(false);
    expect(mayManageRecorded(shared, null, 'jane', 'Member')).toBe(false);
    expect(mayManageRecorded(shared, null, 'jane', 'Admin')).toBe(true);
  });

  it("keeps a personal account's transaction its owner's, whoever recorded it", () => {
    const mine = { visibility: 'personal', ownerUserId: 'jane' } as const;
    expect(mayManageRecorded(mine, 'ben', 'jane', 'Viewer')).toBe(true);
    expect(mayManageRecorded(mine, 'ben', 'ben', 'Owner')).toBe(false);
  });
});
