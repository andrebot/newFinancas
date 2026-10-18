import { describe, expect, it } from 'vitest';
import { goalChangesOf } from '../../../../src/managers/account/goals';

describe('goalChangesOf', () => {
  it('trims the name and keeps every field sent', () => {
    expect(goalChangesOf({
      name: '  House ', targetAmount: 100, targetCurrency: 'USD', dueDate: '2030-12-31',
    })).toEqual({
      name: 'House', targetAmount: 100, targetCurrency: 'USD', dueDate: '2030-12-31',
    });
  });

  it('leaves out the fields not sent', () => {
    expect(goalChangesOf({ name: undefined, dueDate: '2031-01-31' }))
      .toEqual({ dueDate: '2031-01-31' });
    expect(goalChangesOf({})).toEqual({});
  });
});
