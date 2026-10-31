import { describe, expect, it } from 'vitest';
import type { Account } from '../../../../src/accessors/accountAccessor';
import { accessToRecorded } from '../../../../src/managers/transaction/reversal';

// Whose an edited or deleted row is (BDT: unit, pure): its recorder's on a
// shared Account, the Account owner's on a personal one (OQ-111, OQ-223).

const accountOf = (visibility: Account['visibility']) => (
  { visibility, ownerUserId: 'bea' } as Account
);

describe('accessToRecorded', () => {
  it('asks on the recorder when the Account is shared', () => {
    expect(accessToRecorded('caio', 'data.edit')(accountOf('shared')))
      .toEqual({ action: 'data.edit', visibility: 'shared', ownerUserId: 'caio' });
  });

  it('asks on no one for a schedule post on a shared Account — an Owner\'s or Admin\'s', () => {
    expect(accessToRecorded(null, 'data.delete')(accountOf('shared')))
      .toEqual({ action: 'data.delete', visibility: 'shared', ownerUserId: null });
  });

  it('asks on the Account\'s owner when it is personal, whoever recorded the row', () => {
    expect(accessToRecorded('caio', 'data.edit')(accountOf('personal')))
      .toEqual({ action: 'data.edit', visibility: 'personal', ownerUserId: 'bea' });
  });

  it('asks only the membership check when the Account is gone', () => {
    expect(accessToRecorded('caio', 'data.edit')(undefined))
      .toEqual({ action: 'data.view', visibility: 'shared', ownerUserId: null });
  });
});
