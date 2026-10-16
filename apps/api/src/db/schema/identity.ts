import { sql } from 'drizzle-orm';
import {
  check, integer, pgTable, text, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import {
  CASCADE, createdAt, id, instant, isOneOf,
} from './columns';
import {
  INVITABLE_ROLES, INVITATION_STATUSES, LANGUAGES, ROLES, SYSTEM_ROLES, THEMES,
} from './values';

// Identity & Household (02-data-model.md) — IdentityManager's Accessors.

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  mfaSecret: text('mfa_secret').notNull(),
  // Set by the first authenticator code after enrolling (OQ-149); until then
  // signing in answers a fresh enrollment instead of an MFA challenge.
  mfaConfirmedAt: instant('mfa_confirmed_at'),
  // The time step of the last authenticator code accepted: a code works once,
  // so one at or before it is refused (RFC 6238 §5.2, OQ-163).
  mfaLastTotpStep: integer('mfa_last_totp_step'),
  theme: text('theme').notNull().default('dark'),
  language: text('language').notNull().default('pt-BR'),
  // Platform role, not a household role (OQ-111).
  systemRole: text('system_role').notNull().default('USER'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('users_email_key').on(sql`lower(${table.email})`),
  check('users_theme_check', isOneOf(table.theme, THEMES)),
  check('users_language_check', isOneOf(table.language, LANGUAGES)),
  check('users_system_role_check', isOneOf(table.systemRole, SYSTEM_ROLES)),
]);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, CASCADE),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: instant('expires_at').notNull(),
  usedAt: instant('used_at'),
  createdAt: createdAt(),
});

// Failed sign-ins per email address, for the login lockout (OQ-114). Keyed by the
// address, not the user, and deliberately not linked to `users`: an address with
// no account locks exactly like a real one, so a lockout never confirms that an
// email is registered.
export const loginAttempts = pgTable('login_attempts', {
  id: id(),
  // The email as typed, trimmed and lower-cased.
  emailKey: text('email_key').notNull().unique(),
  failedCount: integer('failed_count').notNull(),
  // Start of the counting window; failures before it are forgotten.
  windowStartedAt: instant('window_started_at').notNull(),
  lockedUntil: instant('locked_until'),
}, (table) => [
  check('login_attempts_failed_count_check', sql`${table.failedCount} >= 0`),
]);

export const mfaRecoveryCodes = pgTable('mfa_recovery_codes', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, CASCADE),
  codeHash: text('code_hash').notNull(),
  usedAt: instant('used_at'),
});

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, CASCADE),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  // The token this one replaced: presenting it again means it was stolen (OQ-106).
  previousRefreshTokenHash: text('previous_refresh_token_hash').unique(),
  deviceInfo: text('device_info'),
  createdAt: createdAt(),
  lastUsedAt: instant('last_used_at').notNull().defaultNow(),
  // Sliding: each rotation issues a new refresh token valid for the full TTL.
  expiresAt: instant('expires_at').notNull(),
});

export const households = pgTable('households', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

export const householdMemberships = pgTable('household_memberships', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  userId: uuid('user_id').notNull().references(() => users.id, CASCADE),
  role: text('role').notNull(),
  joinedAt: instant('joined_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('household_memberships_member_key').on(table.householdId, table.userId),
  // Exactly one Owner per household (OQ-28): makes ownership transfer atomic.
  uniqueIndex('household_memberships_one_owner_key').on(table.householdId)
    .where(sql`${table.role} = 'Owner'`),
  check('household_memberships_role_check', isOneOf(table.role, ROLES)),
]);

export const invitations = pgTable('invitations', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  // FR-1.19: invitations target an existing user only — no invite-by-email column.
  invitedUserId: uuid('invited_user_id').notNull().references(() => users.id, CASCADE),
  // Actor reference: nulled by the FR-1.17 routine, so the FK blocks a missed one.
  invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: createdAt(),
  resolvedAt: instant('resolved_at'),
}, (table) => [
  check('invitations_role_check', isOneOf(table.role, INVITABLE_ROLES)),
  check('invitations_status_check', isOneOf(table.status, INVITATION_STATUSES)),
  // One pending invitation per person per household: two simultaneous invites
  // can't both pass the Manager's duplicate check (OQ-109, OQ-118).
  uniqueIndex('invitations_one_pending_key').on(table.householdId, table.invitedUserId)
    .where(sql`${table.status} = 'pending'`),
]);
