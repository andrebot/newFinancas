import { vi } from 'vitest';
import type { AccountDeps } from '../../../../src/managers/account';

// The tier below AccountManager, mocked (BDT: Managers are tested at the seam,
// with their Accessors and Utilities mocked). Each test programs what it needs.

export const NOW = new Date('2026-10-13T12:00:00Z');
export const ANA_ID = '0199c5a0-0000-7000-8000-000000000001';
export const HOUSEHOLD_ID = '0199c5a0-0000-7000-8000-0000000000bb';
export const CORRELATION_ID = '0199c5a0-0000-7000-8000-0000000000cc';
export const ACTOR = { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' as const };
export const CONTEXT = { correlationId: CORRELATION_ID, actor: ACTOR };

export const SUBCATEGORY = {
  id: '0199c5a0-0000-7000-8000-0000000000c2',
  categoryId: '0199c5a0-0000-7000-8000-0000000000c1',
  name: 'Market',
  archivedAt: null,
  createdAt: NOW,
};

export const CATEGORY = {
  id: '0199c5a0-0000-7000-8000-0000000000c1',
  householdId: HOUSEHOLD_ID,
  name: 'Food',
  icon: 'restaurant' as const,
  color: 'coral' as const,
  archivedAt: null,
  createdAt: NOW,
  subcategories: [SUBCATEGORY],
};

/** An Authorization outcome, as AuthorizationUtility returns it. */
type Outcome = { outcome: 'allowed'; role: string }
  | { outcome: 'not_member' | 'forbidden' | 'not_visible' };

/**
 * Builds mocked dependencies with sensible defaults: the actor is the
 * household's Owner, every Accessor call succeeds.
 *
 * @returns The mocks, typed as AccountDeps for the Manager.
 */
export const fakeDeps = () => {
  const categories = {
    list: vi.fn(async () => [CATEGORY]),
    findById: vi.fn(async (): Promise<typeof CATEGORY | undefined> => CATEGORY),
    insert: vi.fn(async (): Promise<typeof CATEGORY | string> => CATEGORY),
    update: vi.fn(async (): Promise<typeof CATEGORY | string> => CATEGORY),
    archive: vi.fn(async () => true),
    archiveSubcategory: vi.fn(async () => true),
    seedDefaults: vi.fn(async () => true),
  };
  const authorization = {
    authorize: vi.fn(async (): Promise<Outcome> => ({ outcome: 'allowed', role: 'Owner' })),
  };
  const deps = { categories, authorization } as unknown as AccountDeps;
  return { deps, categories, authorization };
};
