import { describe, expect, it } from 'vitest';
import requireValidFields from '../../../src/managers/validation';
import { nonBlank } from '../../../src/utilities/validation';

// The rules are ValidationUtility's own, kept real: they are pure (BDT plan).

describe('requireValidFields', () => {
  it('returns quietly when every field passes', () => {
    expect(() => requireValidFields({ name: 'Casa' }, { name: nonBlank })).not.toThrow();
  });

  it('refuses with 422 validation.failed listing every failing field', () => {
    const names = { firstName: ' ', lastName: '' };

    expect(() => requireValidFields(names, { firstName: nonBlank, lastName: nonBlank }))
      .toThrow(expect.objectContaining({
        apiError: expect.objectContaining({
          status: 422,
          code: 'validation.failed',
          details: [
            { field: 'firstName', code: 'string.min', params: { min: 1 } },
            { field: 'lastName', code: 'string.min', params: { min: 1 } },
          ],
        }),
      }));
  });
});
