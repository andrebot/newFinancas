import type { UserHousehold } from '../../accessors/householdAccessor';
import type { ReceivedInvitation } from '../../accessors/invitationAccessor';
import type { User } from '../../accessors/userAccessor';
import type { SessionView } from '../../managers/identity';

// IdentityManager's results in the contract's JSON shapes: times as ISO
// strings, only the fields the contract names (no system role, no expiry).

/**
 * A user as the contract shows it (`components/schemas/User`).
 *
 * @param user - The account.
 * @returns The JSON shape.
 */
export const toUserJson = (user: User) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  createdAt: user.createdAt.toISOString(),
  preferences: { theme: user.theme, language: user.language },
});

/**
 * A session as the contract shows it (`components/schemas/Session`).
 *
 * @param session - The use case's view.
 * @returns The JSON shape.
 */
export const toSessionJson = (session: SessionView) => ({
  id: session.id,
  deviceInfo: session.deviceInfo,
  createdAt: session.createdAt.toISOString(),
  lastUsedAt: session.lastUsedAt.toISOString(),
  current: session.current,
});

/**
 * One of the caller's households (`components/schemas/MyHousehold`).
 *
 * @param household - The household and the caller's role in it.
 * @returns The JSON shape.
 */
export const toMyHouseholdJson = (household: UserHousehold) => ({
  id: household.id,
  name: household.name,
  createdAt: household.createdAt.toISOString(),
  role: household.role,
});

/**
 * An invitation waiting for the caller (`components/schemas/ReceivedInvitation`).
 *
 * @param invitation - The invitation with the names to show.
 * @returns The JSON shape.
 */
export const toReceivedInvitationJson = (invitation: ReceivedInvitation) => ({
  id: invitation.id,
  householdId: invitation.householdId,
  householdName: invitation.householdName,
  role: invitation.role,
  invitedByUserId: invitation.invitedByUserId,
  inviterFirstName: invitation.inviterFirstName,
  inviterLastName: invitation.inviterLastName,
  createdAt: invitation.createdAt.toISOString(),
});
