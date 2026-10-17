import { actorLabel, createLogger, type Logger } from '@financas/logging';
import type { HouseholdAccessor } from '../../accessors/householdAccessor';
import type { InvitationAccessor } from '../../accessors/invitationAccessor';
import type { SessionAccessor } from '../../accessors/sessionAccessor';
import type { UserAccessor } from '../../accessors/userAccessor';
import { authentication } from '../../config/constants';
import type { NotificationEngine } from '../../engines/notification';
import type { AuthenticationUtility } from '../../utilities/authentication';
import type { AuthorizationUtility } from '../../utilities/authorization';
import type { ServiceBus } from '../../utilities/serviceBus';
import type { RequestContext } from '../requestContext';

export type { RequestContext, SignedInContext } from '../requestContext';

// What every IdentityManager use case shares: its dependencies (the tier below,
// injected so integration tests mock exactly that tier — BDT), the request it
// runs for, and a logger carrying that request's correlation ID and actor.

/** The components IdentityManager calls. */
export interface IdentityDeps {
  readonly users: UserAccessor;
  readonly sessions: SessionAccessor;
  readonly households: HouseholdAccessor;
  readonly invitations: InvitationAccessor;
  readonly authentication: AuthenticationUtility;
  readonly authorization: AuthorizationUtility;
  readonly bus: Pick<ServiceBus, 'publish'>;
  readonly notifications: NotificationEngine;
  /** Where the web app runs; email links point here (WEB_APP_URL). */
  readonly webAppUrl: string;
  readonly now: () => Date;
}

/** What a client keeps after signing in or refreshing. */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** What an unconfirmed MFA enrollment hands the client, once (OQ-149). */
export interface EnrollmentStart {
  /** Fifteen-minute JWT that, with the first authenticator code, confirms the enrollment. */
  readonly enrollmentToken: string;
  readonly totpSecret: string;
  /** The `otpauth://` URI the QR code encodes — issuer and TOTP settings included. */
  readonly otpauthUri: string;
  readonly recoveryCodes: readonly string[];
}

/** A fresh enrollment's plain parts, as AuthenticationUtility.enrollMfa returns them. */
interface PlainEnrollment {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly recoveryCodes: readonly string[];
}

/**
 * Hands a fresh, unconfirmed enrollment to the client: its plain secret, QR URI
 * and recovery codes, and the token that confirms it (OQ-149).
 *
 * @param auth - Signs the enrollment token.
 * @param user - Whose enrollment: the token names their id and address.
 * @param enrollment - The plain secret, URI and codes.
 * @returns What the client shows and sends back.
 */
export const enrollmentStart = async (
  auth: Pick<AuthenticationUtility, 'signEnrollmentToken'>,
  user: { readonly id: string; readonly email: string },
  enrollment: PlainEnrollment,
): Promise<EnrollmentStart> => ({
  enrollmentToken: await auth.signEnrollmentToken({ userId: user.id, email: user.email }),
  totpSecret: enrollment.secret,
  otpauthUri: enrollment.otpauthUri,
  recoveryCodes: enrollment.recoveryCodes,
});

/**
 * A logger for one use case run, labelled IdentityManager.
 *
 * @param context - The request.
 * @param userId - The acting user when known but not yet in the context (e.g. just signed in).
 * @returns The logger.
 */
export const loggerFor = (context: RequestContext, userId?: string): Logger => {
  const actorId = context.actor?.userId ?? userId;
  return createLogger({
    label: 'IdentityManager',
    correlationId: context.correlationId,
    actor: actorId ? actorLabel({ userId: actorId }) : actorLabel('unauthenticated'),
  });
};

/**
 * The key failed sign-ins are counted under: the address as typed, trimmed and
 * lower-cased — not the user, so unknown addresses lock too (OQ-114).
 *
 * @param email - The email as typed.
 * @returns The key.
 */
export const emailKeyOf = (email: string): string => email.trim().toLowerCase();

/**
 * When a refresh token issued now stops working (30-day sliding expiry, OQ-30).
 *
 * @param now - Issue time.
 * @returns The expiry.
 */
export const refreshTokenExpiry = (now: Date): Date => (
  new Date(now.getTime() + authentication.refreshToken.ttlDays * 86_400_000)
);
