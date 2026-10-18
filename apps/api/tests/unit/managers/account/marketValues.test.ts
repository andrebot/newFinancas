import { describe, expect, it } from 'vitest';
import { valuationChangesOf } from '../../../../src/managers/account/marketValues';

describe('valuationChangesOf', () => {
  it('renames each field sent to the Accessor\'s name', () => {
    expect(valuationChangesOf({ value: 0, asOf: '2026-10-01' }))
      .toEqual({ valuation: 0, asOfDate: '2026-10-01' });
  });

  it('leaves out the fields not sent', () => {
    expect(valuationChangesOf({ value: 5 })).toEqual({ valuation: 5 });
    expect(valuationChangesOf({ asOf: '2026-10-01' })).toEqual({ asOfDate: '2026-10-01' });
    expect(valuationChangesOf({})).toEqual({});
  });
});
