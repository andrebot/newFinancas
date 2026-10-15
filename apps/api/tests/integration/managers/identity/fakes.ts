import { vi } from 'vitest';
import type { IdentityDeps } from '../../../../src/managers/identity';

// The tier below IdentityManager, mocked (BDT: Managers are tested at the seam,
// with their Accessors and Utilities mocked). Each test programs what it needs.

export const NOW = new Date('2026-10-13T12:00:00Z');
export const minutes = (count: number) => new Date(NOW.getTime() + count * 60_000);

export const ANA = {
  id: '0199c5a0-0000-7000-8000-000000000001',
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'Lima',
  theme: 'dark',
  language: 'pt-BR',
  systemRole: 'USER',
  createdAt: NOW,
  passwordHash: '$argon2id$ana',
  encryptedMfaSecret: 'sealed-secret',
  mfaConfirmedAt: NOW as Date | null,
} as const;

export const SESSION = {
  id: '0199c5a0-0000-7000-8000-0000000000aa',
  userId: ANA.id,
  deviceInfo: 'Firefox' as string | null,
  createdAt: NOW,
  lastUsedAt: NOW,
  expiresAt: minutes(30 * 24 * 60),
};

export const HOUSEHOLD = {
  id: '0199c5a0-0000-7000-8000-0000000000bb', name: 'Casa', createdAt: NOW, role: 'Owner' as const,
};

export const BEN_ID = '0199c5a0-0000-7000-8000-000000000002';

export const MEMBER = {
  userId: BEN_ID,
  firstName: 'Ben',
  lastName: 'Demo',
  email: 'ben@example.com',
  role: 'Member' as const,
  joinedAt: NOW,
};

export const INVITATION = {
  id: '0199c5a0-0000-7000-8000-0000000000dd',
  householdId: '0199c5a0-0000-7000-8000-0000000000bb',
  invitedUserId: BEN_ID,
  invitedByUserId: '0199c5a0-0000-7000-8000-000000000001',
  role: 'Member' as const,
  status: 'pending' as const,
  createdAt: NOW,
  resolvedAt: null,
};

export const RECEIVED = {
  id: '0199c5a0-0000-7000-8000-0000000000dd',
  householdId: HOUSEHOLD.id,
  householdName: 'Casa',
  role: 'Member' as const,
  invitedByUserId: null,
  inviterFirstName: null,
  inviterLastName: null,
  createdAt: NOW,
};

/**
 * Builds mocked dependencies with sensible defaults: no lock, Ana exists, every
 * factor is valid, tokens are predictable.
 *
 * @returns The mocks, typed as IdentityDeps for the Manager.
 */
export const fakeDeps = () => {
  const users = {
    insert: vi.fn(async () => ({ ok: true as const, user: ANA })),
    findByEmail: vi.fn(async (): Promise<typeof ANA | undefined> => ANA),
    findById: vi.fn(async (): Promise<typeof ANA | undefined> => ANA),
    findLoginLock: vi.fn(async (): Promise<Date | undefined> => undefined),
    recordLoginFailure: vi.fn(async () => 1),
    lockLogin: vi.fn(async () => undefined),
    clearLoginFailures: vi.fn(async () => undefined),
    consumeRecoveryCode: vi.fn(async () => true),
    replaceMfaEnrollment: vi.fn(async (): Promise<'replaced' | 'stale'> => 'replaced'),
    confirmMfaEnrollment: vi.fn(async (): Promise<'confirmed' | 'stale'> => 'confirmed'),
    findPasswordHash: vi.fn(async (): Promise<string | undefined> => ANA.passwordHash),
    updatePasswordHash: vi.fn(async () => true),
    storeResetToken: vi.fn(async () => undefined),
    consumeResetToken: vi.fn(async (): Promise<string | undefined> => ANA.id),
    update: vi.fn(async (): Promise<typeof ANA | undefined> => ANA),
  };
  const households = {
    listForUser: vi.fn(async () => [HOUSEHOLD]),
    insert: vi.fn(async () => ({ id: HOUSEHOLD.id, name: 'Casa', createdAt: NOW })),
    delete: vi.fn(async () => true),
    listMembers: vi.fn(async () => [MEMBER]),
    findMembership: vi.fn(async (): Promise<{ role: string; joinedAt: Date } | undefined> => (
      { role: 'Member', joinedAt: NOW }
    )),
    findSuccessor: vi.fn(async (): Promise<{ userId: string; role: string } | undefined> => (
      { userId: BEN_ID, role: 'Admin' }
    )),
    swapOwner: vi.fn(async (): Promise<'swapped' | 'stale'> => 'swapped'),
    removeMember: vi.fn(async (): Promise<'removed' | 'stale'> => 'removed'),
    updateRole: vi.fn(async (): Promise<'updated' | 'stale'> => 'updated'),
    dissolve: vi.fn(async (): Promise<'dissolved' | 'stale'> => 'dissolved'),
    addMember: vi.fn(async (): Promise<'added' | 'already_member'> => 'added'),
  };
  const authorization = {
    authorize: vi.fn(async (): Promise<{ outcome: string; role?: string }> => (
      { outcome: 'allowed', role: 'Owner' }
    )),
  };
  const bus = { publish: vi.fn() };
  const invitations = {
    listPendingForUser: vi.fn(async () => [RECEIVED]),
    insert: vi.fn(async (): Promise<
      { ok: true; invitation: typeof INVITATION } | { ok: false; reason: string }
    > => ({ ok: true, invitation: INVITATION })),
    findById: vi.fn(async (): Promise<typeof INVITATION | undefined> => INVITATION),
    findPending: vi.fn(async (): Promise<typeof INVITATION | undefined> => undefined),
    listForHousehold: vi.fn(async () => [INVITATION]),
    resolve: vi.fn(async (): Promise<'resolved' | 'stale'> => 'resolved'),
  };
  const sessions = {
    insert: vi.fn(async () => SESSION),
    rotate: vi.fn(async () => ({ status: 'rotated' as const, session: SESSION })),
    findByReplacedToken: vi.fn(
      async (): Promise<{ id: string; userId: string } | undefined> => undefined,
    ),
    listByUser: vi.fn(async () => [SESSION]),
    deleteForUser: vi.fn(async () => true),
    deleteAllExceptCurrent: vi.fn(async () => 2),
    deleteAllForUser: vi.fn(async () => 3),
  };
  const authentication = {
    hashPassword: vi.fn(async (password: string) => `hash(${password})`),
    verifyPassword: vi.fn(async () => true),
    verifyTotp: vi.fn(() => true),
    enrollMfa: vi.fn(() => ({
      secret: 'TOTPSECRET',
      otpauthUri: 'otpauth://totp/x',
      recoveryCodes: ['CODE1', 'CODE2'],
      recoveryCodeHashes: ['h1', 'h2'],
      encryptedSecret: 'sealed-new',
    })),
    issueOpaqueToken: vi.fn(() => ({ token: 'refresh-token', tokenHash: 'refresh-hash' })),
    hashOpaqueToken: vi.fn((token: string) => `hash(${token})`),
    signAccessToken: vi.fn(async () => 'access-token'),
    signChallengeToken: vi.fn(async () => 'challenge-token'),
    verifyChallengeToken: vi.fn(
      async (): Promise<{ userId: string; email: string } | undefined> => (
        { userId: ANA.id, email: ANA.email }
      ),
    ),
    signEnrollmentToken: vi.fn(async () => 'enrollment-token'),
    verifyEnrollmentToken: vi.fn(
      async (): Promise<{ userId: string; email: string } | undefined> => (
        { userId: ANA.id, email: ANA.email }
      ),
    ),
    hashRecoveryCode: vi.fn((code: string) => `code-hash(${code})`),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  const deps = {
    users,
    sessions,
    households,
    invitations,
    authorization,
    bus,
    authentication,
    notifications,
    webAppUrl: 'http://web.test',
    now: () => NOW,
  } as unknown as IdentityDeps;
  return {
    deps,
    users,
    sessions,
    households,
    invitations,
    authorization,
    bus,
    authentication,
    notifications,
  };
};
