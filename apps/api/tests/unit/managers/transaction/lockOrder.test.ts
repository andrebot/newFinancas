import { describe, expect, it } from 'vitest';
import {
  accountsInLockOrder, inLockOrder,
} from '../../../../src/managers/transaction/lockOrder';
import type { EditableRow } from '../../../../src/managers/transaction/reversal';

// The order a transfer pair's Accounts are written in (BDT: unit, pure): by
// Account id, whichever side comes first (OQ-222, PR #145 review).

describe('inLockOrder', () => {
  it('puts the lower Account id first', () => {
    const side = (id: string) => ({ side: { account: { id } } as Pick<EditableRow, 'account'> });
    expect(inLockOrder([side('b'), side('a')]).map((step) => step.side.account.id))
      .toEqual(['a', 'b']);
  });
});

describe('accountsInLockOrder', () => {
  it('puts the lower Account id first, keeping what moves each', () => {
    expect(accountsInLockOrder([
      { account: { id: 'savings' }, amount: 1 },
      { account: { id: 'checking' }, amount: 2 },
    ])).toEqual([
      { account: { id: 'checking' }, amount: 2 },
      { account: { id: 'savings' }, amount: 1 },
    ]);
  });
});
