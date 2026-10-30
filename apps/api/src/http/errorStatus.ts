import type { ErrorCode } from '@financas/i18n';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// The one place an error code meets its HTTP status (OQ-202): the system refuses
// by code (`utilities/domainError.ts`), and the HTTP layer answers with the
// status this table gives it. Keyed by every code the catalog translates, so a
// new code without a status does not compile; a test checks it against the
// codes `openapi.yaml`'s shared responses list.

/** The HTTP status each API error code is answered with. */
const STATUS_OF: Readonly<Record<ErrorCode, ContentfulStatusCode>> = {
  'account.archived': 409,
  'account.cards_not_allowed': 422,
  'account.not_found': 404,
  'auth.challenge_expired': 401,
  'auth.enrollment_expired': 401,
  'auth.forbidden': 403,
  'auth.invalid_credentials': 401,
  'auth.mfa_invalid': 401,
  'auth.refresh_invalid': 401,
  'auth.too_many_attempts': 429,
  'auth.unauthenticated': 401,
  'budget.not_found': 404,
  'budget.target_already_claimed': 409,
  'category.archived': 422,
  'category.not_found': 404,
  'credit_card.account_archived': 409,
  'credit_card.not_found': 404,
  'goal.allocation_exceeds_100': 409,
  'goal.completed': 409,
  'goal.not_found': 404,
  'holding.archived': 409,
  'holding.cost_basis_below_zero': 409,
  'holding.insufficient_quantity': 409,
  'holding.not_found': 404,
  'holding.not_market_priced': 409,
  'holding.not_matured': 409,
  'household.changed': 409,
  'household.member_not_found': 404,
  'household.not_found': 404,
  'index_rate.duplicate_day': 409,
  'index_rate.missing': 422,
  'index_rate.not_found': 404,
  'internal.unexpected': 500,
  'invitation.already_member': 409,
  'invitation.already_pending': 409,
  'invitation.invitee_not_registered': 404,
  'invitation.not_found': 404,
  'invitation.not_pending': 409,
  'notification.not_found': 404,
  'password.current_incorrect': 422,
  'password.too_short': 422,
  'password_reset.token_invalid': 400,
  'report.unknown_type_or_range': 400,
  'request.invalid': 400,
  'route.not_found': 404,
  'session.not_found': 404,
  'snapshot.automatic_not_editable': 409,
  'snapshot.not_found': 404,
  'subcategory.not_found': 404,
  'transaction.changed': 409,
  'transaction.currency_mismatch': 422,
  'transaction.holding_in_use': 409,
  'transaction.investment_not_allowed_on_account': 422,
  'transaction.kind_not_allowed_for_target': 422,
  'transaction.not_found': 404,
  'transaction.schedule_started': 409,
  'transaction.subcategory_mismatch': 422,
  'user.email_taken': 409,
  'validation.failed': 422,
};

export default STATUS_OF;
