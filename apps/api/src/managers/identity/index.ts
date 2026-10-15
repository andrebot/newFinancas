import type { IdentityDeps } from './context';
import createHouseholds from './households';
import createInvitations from './invitations';
import createMembers from './members';
import createPasswords from './passwords';
import createProfile from './profile';
import createRegistration from './registration';
import createSessions from './sessions';
import createSignIn from './signIn';

// IdentityManager (M1, VBD §2.1): users, sessions and — in the next steps —
// households, members and invitations. Each use case decides; the Accessors
// apply (OQ-107). Built in parts so each stays small.

export type {
  AuthTokens, EnrollmentStart, IdentityDeps, RequestContext, SignedInContext,
} from './context';
export type { Registered, Registration } from './registration';
export type { SessionView } from './sessions';
export type { InvitationRequest } from './invitations';
export type { PasswordChange, PasswordResetConfirmation } from './passwords';
export type { ProfileEdit } from './profile';
export type {
  Challenge, Credentials, EnrollmentConfirmation, EnrollmentStep, LoginStep, MfaVerification,
  RecoveryVerification,
} from './signIn';

/**
 * Creates IdentityManager.
 *
 * @param deps - The Accessors and Utilities it calls, and the clock.
 * @returns Every IdentityManager use case.
 */
export const createIdentityManager = (deps: IdentityDeps) => ({
  ...createRegistration(deps),
  ...createSignIn(deps),
  ...createSessions(deps),
  ...createPasswords(deps),
  ...createProfile(deps),
  ...createHouseholds(deps),
  ...createMembers(deps),
  ...createInvitations(deps),
});

export type IdentityManager = ReturnType<typeof createIdentityManager>;
