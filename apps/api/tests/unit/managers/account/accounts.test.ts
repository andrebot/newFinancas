import { describe, expect, it } from 'vitest';
import { accountChangesOf, cardChangesOf } from '../../../../src/managers/account/accounts';

describe('accountChangesOf', () => {
  it('trims the name and leaves out fields not sent', () => {
    expect(accountChangesOf({ name: ' Main ', visibility: undefined, cards: { remove: ['c1'] } }))
      .toEqual({ name: 'Main' });
  });

  it('keeps a visibility change', () => {
    expect(accountChangesOf({ visibility: 'shared' })).toEqual({ visibility: 'shared' });
  });

  it('is empty for an empty edit', () => {
    expect(accountChangesOf({})).toEqual({});
  });
});

describe('cardChangesOf', () => {
  it('leaves out the id and fields not sent', () => {
    expect(cardChangesOf({
      id: 'c1', closingDay: 5, dueDay: undefined, last4: '4242',
    }))
      .toEqual({ closingDay: 5, last4: '4242' });
  });

  it('is empty when only the id is sent', () => {
    expect(cardChangesOf({ id: 'c1' })).toEqual({});
  });
});
