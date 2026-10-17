import { describe, expect, it } from 'vitest';
import { changesOf } from '../../../../src/managers/account/categories';

describe('changesOf', () => {
  it('trims names and leaves out fields not sent', () => {
    expect(changesOf({
      name: ' Food ',
      icon: undefined,
      color: 'coral',
      subcategories: [{ id: 's1', name: ' Market' }, { id: undefined, name: 'Bakery ' }],
    })).toEqual({
      name: 'Food',
      color: 'coral',
      subcategories: [{ id: 's1', name: 'Market' }, { name: 'Bakery' }],
    });
  });

  it('is empty for an empty edit', () => {
    expect(changesOf({})).toEqual({});
  });
});
