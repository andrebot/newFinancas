import { describe, expect, it } from 'vitest';
import { fullName } from '../../../src/utilities/personName';

// Utility (BDT: unit, pure — nothing to mock).

describe('fullName', () => {
  it('joins the names, skipping a blank one', () => {
    expect(fullName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
    expect(fullName({ firstName: 'Cher', lastName: '' })).toBe('Cher');
    expect(fullName({ firstName: '', lastName: 'Doe' })).toBe('Doe');
  });
});
