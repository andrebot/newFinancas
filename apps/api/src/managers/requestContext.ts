import type { AccessTokenClaims } from '../utilities/authentication';

// The request a Manager use case runs for — shared by every Manager, so none
// imports another's types.

/** The request a use case runs for: its correlation ID and, once signed in, its actor. */
export interface RequestContext {
  readonly correlationId: string;
  readonly actor?: AccessTokenClaims;
}

/** A signed-in request. */
export interface SignedInContext extends RequestContext {
  readonly actor: AccessTokenClaims;
}
