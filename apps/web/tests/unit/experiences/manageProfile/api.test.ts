import type { User } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import { withPreferences } from '../../../../src/experiences/manageProfile/api';

// The endpoints' requests and answers are covered through the Experience
// (BDT: integration over the real store, `fetch` faked); this is the one pure
// helper beside them.

const JANE: User = {
  id: 'jane',
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: '2026-01-01T00:00:00Z',
  preferences: { theme: 'dark', language: 'en-US' },
};

describe('withPreferences', () => {
  it('replaces only the preferences sent', () => {
    expect(withPreferences(JANE, { language: 'pt-BR' })).toEqual({
      ...JANE, preferences: { theme: 'dark', language: 'pt-BR' },
    });
    expect(withPreferences(JANE, { theme: 'system' }).preferences).toEqual({
      theme: 'system', language: 'en-US',
    });
  });
});
