import type { UserHousehold } from '../../accessors/householdAccessor';
import type { ReceivedInvitation } from '../../accessors/invitationAccessor';
import type { User, UserChanges } from '../../accessors/userAccessor';
import type { Language, Theme } from '../../db/schema/values';
import { loggerFor, type IdentityDeps, type SignedInContext } from './context';
import { unauthenticated } from './errors';

// View / Edit User (uc-13, FR-1.21) and List My Households (uc-21, FR-1.8):
// plain reads and one edit of Identity's own entities (read-ownership rule).

/** What Edit User may change; email and password have their own flows. */
export interface ProfileEdit {
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly preferences?: {
    readonly theme?: Theme | undefined;
    readonly language?: Language | undefined;
  } | undefined;
}

/**
 * The fields an edit actually changes: names trimmed (OQ-108), preferences
 * flattened, anything not sent left out.
 *
 * @param edit - What the user sent.
 * @returns The changes for UserAccessor.update.
 */
export const changesOf = (edit: ProfileEdit): UserChanges => {
  const candidates = {
    firstName: edit.firstName?.trim(),
    lastName: edit.lastName?.trim(),
    theme: edit.preferences?.theme,
    language: edit.preferences?.language,
  };
  return Object.fromEntries(
    Object.entries(candidates).filter(([, value]) => value !== undefined),
  );
};

/**
 * Builds the profile and listing use cases.
 *
 * @param deps - The tier below.
 * @returns `getProfile`, `editProfile`, `listMyHouseholds`, `listMyInvitations`.
 */
const createProfile = (deps: IdentityDeps) => {
  const { users } = deps;

  /**
   * The caller's account.
   *
   * @param context - The signed-in request.
   * @returns The user.
   * @throws {ApiError} 401 `auth.unauthenticated` when the account is gone.
   */
  const getProfile = async (context: SignedInContext): Promise<User> => {
    const user = await users.findById(context.actor.userId);
    if (!user) throw unauthenticated();
    return user;
  };

  return {
    getProfile,

    /**
     * Edits the caller's name and preferences (uc-13, FR-1.21). An edit that
     * changes nothing just returns the profile.
     *
     * @param context - The signed-in request.
     * @param edit - The fields to change.
     * @returns The updated user.
     * @throws {ApiError} 401 `auth.unauthenticated` when the account is gone.
     */
    editProfile: async (context: SignedInContext, edit: ProfileEdit): Promise<User> => {
      const changes = changesOf(edit);
      if (Object.keys(changes).length === 0) return getProfile(context);
      const user = await users.update(context.actor.userId, changes);
      if (!user) throw unauthenticated();
      loggerFor(context)
        .audit('EditUser', { entityType: 'User', entityId: user.id, householdId: null });
      return user;
    },

    /**
     * The households the caller belongs to, with their role in each — the
     * household switcher (uc-21, FR-1.8).
     *
     * @param context - The signed-in request.
     * @returns The households.
     */
    listMyHouseholds: (context: SignedInContext): Promise<UserHousehold[]> => (
      deps.households.listForUser(context.actor.userId)
    ),

    /**
     * Invitations waiting for the caller, with the household's and inviter's
     * names — the invitee isn't a member yet, so it can't look them up (uc-21).
     *
     * @param context - The signed-in request.
     * @returns The pending invitations.
     */
    listMyInvitations: (context: SignedInContext): Promise<ReceivedInvitation[]> => (
      deps.invitations.listPendingForUser(context.actor.userId)
    ),
  };
};

export default createProfile;
