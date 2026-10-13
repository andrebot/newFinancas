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
} as const;

export const SESSION = {
  id: '0199c5a0-0000-7000-8000-0000000000aa',
  userId: ANA.id,
  deviceInfo: 'Firefox' as string | null,
  createdAt: NOW,
  lastUsedAt: NOW,
  expiresAt: minutes(30 * 24 * 60),
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
  };
  const deps = {
    users, sessions, authentication, now: () => NOW,
  } as unknown as IdentityDeps;
  return {
    deps, users, sessions, authentication,
  };
};
