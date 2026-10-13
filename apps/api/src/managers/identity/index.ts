import type { IdentityDeps } from './context';
import createRegistration from './registration';
import createSessions from './sessions';
import createSignIn from './signIn';

// IdentityManager (M1, VBD §2.1): users, sessions and — in the next steps —
// households, members and invitations. Each use case decides; the Accessors
// apply (OQ-107). Built in parts so each stays small.

export type {
  AuthTokens, IdentityDeps, RequestContext, SignedInContext,
} from './context';
export type { Registered, Registration } from './registration';
export type { SessionView } from './sessions';
export type { Credentials } from './signIn';

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
});

export type IdentityManager = ReturnType<typeof createIdentityManager>;
