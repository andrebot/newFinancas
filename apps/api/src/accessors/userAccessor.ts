import {
  and, eq, gt, isNull, sql,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { PG_FOREIGN_KEY_VIOLATION, PG_UNIQUE_VIOLATION, pgErrorCode } from '../db/errors';
import { mfaRecoveryCodes, passwordResetTokens, users } from '../db/schema';
import type { Language, SystemRole, Theme } from '../db/schema/values';

// UserAccessor (A1, VBD): users and their credentials — password hash, the
// encrypted MFA secret, recovery codes and password-reset tokens. Stores only
// what AuthenticationUtility produced (hashes, ciphertext), never a plain secret.
// Expected outcomes are typed results; only unexpected failures throw (OQ-103).

/** A user as the rest of the system sees it — no credentials. */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly theme: Theme;
  readonly language: Language;
  /** Platform role (OQ-111); set only by the database default for now. */
  readonly systemRole: SystemRole;
  readonly createdAt: Date;
}

/** A user plus what proves their identity, for the authentication flows only. */
export interface UserWithCredentials extends User {
  readonly passwordHash: string;
  /** AES-GCM sealed TOTP secret (OQ-100). */
  readonly encryptedMfaSecret: string;
}

/** What registration stores. */
export interface NewUser {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly passwordHash: string;
  readonly encryptedMfaSecret: string;
  readonly recoveryCodeHashes: readonly string[];
  readonly language?: Language;
  readonly theme?: Theme;
}

/** Profile fields a user can change (FR-1.21). */
export interface UserChanges {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly theme?: Theme;
  readonly language?: Language;
}

export type InsertUserResult = | { readonly ok: true; readonly user: User }
  | { readonly ok: false; readonly reason: 'email_taken' };

export type DeleteUserResult = 'deleted' | 'not_found' | 'still_referenced';

const userColumns = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  theme: users.theme,
  language: users.language,
  systemRole: users.systemRole,
  createdAt: users.createdAt,
};

type UserRow = Omit<User, 'theme' | 'language' | 'systemRole'> & {
  theme: string; language: string; systemRole: string;
};

/**
 * Narrows a row's text columns to their value sets (the database CHECKs guarantee them).
 *
 * @param row - A selected user row.
 * @returns The domain user.
 */
const toUser = (row: UserRow): User => ({
  ...row,
  theme: row.theme as Theme,
  language: row.language as Language,
  systemRole: row.systemRole as SystemRole,
});

/**
 * Builds the UserAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createUserAccessor = (db: Database) => ({
  /**
   * Registers a user with their credentials and recovery codes, atomically.
   *
   * @param user - Profile, password hash, sealed MFA secret, recovery-code hashes.
   * @returns The new user, or `email_taken` (case-insensitive) — nothing is written then.
   */
  insert: async (user: NewUser): Promise<InsertUserResult> => {
    try {
      const created = await db.transaction(async (tx) => {
        const [row] = await tx.insert(users).values({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          passwordHash: user.passwordHash,
          mfaSecret: user.encryptedMfaSecret,
          ...(user.language ? { language: user.language } : {}),
          ...(user.theme ? { theme: user.theme } : {}),
        }).returning(userColumns);
        if (user.recoveryCodeHashes.length > 0) {
          await tx.insert(mfaRecoveryCodes).values(
            user.recoveryCodeHashes.map((codeHash) => ({ userId: row!.id, codeHash })),
          );
        }
        return toUser(row!);
      });
      return { ok: true, user: created };
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) return { ok: false, reason: 'email_taken' };
      throw error;
    }
  },

  /**
   * Finds a user by email, ignoring case — matching the unique index on
   * lower(email) — with credentials (login, registration check, reset, MFA
   * recovery). Cleaning up the input (trimming) is the caller's job (OQ-108).
   *
   * @param email - The email, already normalised by the caller.
   * @returns The user with credentials, or `undefined`.
   */
  findByEmail: async (email: string): Promise<UserWithCredentials | undefined> => {
    const [row] = await db.select({
      ...userColumns, passwordHash: users.passwordHash, encryptedMfaSecret: users.mfaSecret,
    }).from(users).where(sql`lower(${users.email}) = lower(${email})`);
    return row && {
      ...toUser(row), passwordHash: row.passwordHash, encryptedMfaSecret: row.encryptedMfaSecret,
    };
  },

  /**
   * Finds a user by id, without credentials.
   *
   * @param id - User id.
   * @returns The user, or `undefined`.
   */
  findById: async (id: string): Promise<User | undefined> => {
    const [row] = await db.select(userColumns).from(users).where(eq(users.id, id));
    return row && toUser(row);
  },

  /**
   * Reads a user's password hash (change password re-checks the current one).
   *
   * @param id - User id.
   * @returns The hash, or `undefined` when the user doesn't exist.
   */
  findPasswordHash: async (id: string): Promise<string | undefined> => {
    const [row] = await db.select({ passwordHash: users.passwordHash }).from(users)
      .where(eq(users.id, id));
    return row?.passwordHash;
  },

  /**
   * Updates profile fields and preferences; omitted fields are left as they are.
   *
   * @param id - User id.
   * @param changes - Fields to change.
   * @returns The updated user, or `undefined` when the user doesn't exist.
   */
  update: async (id: string, changes: UserChanges): Promise<User | undefined> => {
    const [row] = await db.update(users).set(changes).where(eq(users.id, id))
      .returning(userColumns);
    return row && toUser(row);
  },

  /**
   * Replaces a user's password hash.
   *
   * @param id - User id.
   * @param passwordHash - New Argon2id hash.
   * @returns `true` when the user existed.
   */
  updatePasswordHash: async (id: string, passwordHash: string): Promise<boolean> => {
    const updated = await db.update(users).set({ passwordHash }).where(eq(users.id, id))
      .returning({ id: users.id });
    return updated.length > 0;
  },

  /**
   * Uses up a recovery code: one atomic statement, so a code can't be used twice
   * even by two simultaneous requests (FR-1.16).
   *
   * @param userId - Whose code.
   * @param codeHash - Hash of the code typed (AuthenticationUtility.hashRecoveryCode).
   * @param now - When it is used.
   * @returns `true` when an unused matching code was consumed.
   */
  consumeRecoveryCode: async (userId: string, codeHash: string, now: Date): Promise<boolean> => {
    const consumed = await db.update(mfaRecoveryCodes).set({ usedAt: now })
      .where(and(
        eq(mfaRecoveryCodes.userId, userId),
        eq(mfaRecoveryCodes.codeHash, codeHash),
        isNull(mfaRecoveryCodes.usedAt),
      ))
      .returning({ id: mfaRecoveryCodes.id });
    return consumed.length > 0;
  },

  /**
   * Stores a password-reset token's hash (the token itself goes only to the user).
   *
   * @param userId - Whose reset.
   * @param tokenHash - AuthenticationUtility.issueOpaqueToken's hash.
   * @param expiresAt - When it stops working.
   * @returns Resolves once stored.
   */
  storeResetToken: async (userId: string, tokenHash: string, expiresAt: Date): Promise<void> => {
    await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  },

  /**
   * Uses up a reset token if it is unused and unexpired, atomically — the link
   * works exactly once (FR-1.13, OQ-103).
   *
   * @param tokenHash - Hash of the token from the link.
   * @param now - Current time.
   * @returns The user whose password may now be reset, or `undefined`.
   */
  consumeResetToken: async (tokenHash: string, now: Date): Promise<string | undefined> => {
    const [row] = await db.update(passwordResetTokens).set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ))
      .returning({ userId: passwordResetTokens.userId });
    return row?.userId;
  },

  /**
   * Deletes a user; credentials, codes, tokens, sessions and memberships go with
   * them (FK cascade). Fails safely while the FR-1.17 routine has left personal or
   * provenance references behind.
   *
   * @param id - User id.
   * @returns `deleted`, `not_found`, or `still_referenced` (nothing deleted).
   */
  delete: async (id: string): Promise<DeleteUserResult> => {
    try {
      const deleted = await db.transaction((tx) => tx.delete(users).where(eq(users.id, id))
        .returning({ id: users.id }));
      return deleted.length > 0 ? 'deleted' : 'not_found';
    } catch (error) {
      if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) return 'still_referenced';
      throw error;
    }
  },
});

/** The UserAccessor's operations, as injected into IdentityManager. */
export type UserAccessor = ReturnType<typeof createUserAccessor>;

export default createUserAccessor;
