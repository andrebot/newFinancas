import { describe, expect, it } from 'vitest';
import { hasSystemRole } from '../../../../src/utilities/authorization';

describe('hasSystemRole (OQ-111)', () => {
  it.each([
    ['USER', 'USER', true],
    ['ADMIN', 'USER', true],
    ['ADMIN', 'ADMIN', true],
    ['USER', 'ADMIN', false],
  ] as const)('a %s calling an API that requires %s: %s', (systemRole, required, allowed) => {
    expect(hasSystemRole(systemRole, required)).toBe(allowed);
  });
});
