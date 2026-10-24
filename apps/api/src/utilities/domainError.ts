import type { ErrorCode } from '@financas/i18n';
import type { FieldDetail } from './validation';

// How the system refuses a request (OQ-202, revising OQ-114): the contract's
// code — the business and security decision, e.g. one answer for every login
// failure — with its params and field details, and nothing about any transport.
// Managers throw it; the HTTP layer answers it, looking the status up by code
// (`http/errorStatus.ts`), so no Manager knows which HTTP status it becomes.

/** A refusal: everything the error envelope needs except the transport's parts. */
export interface DomainErrorInit {
  /**
   * Namespaced and stable (`domain.reason`), localized by the frontend (OQ-83).
   * Typed by the i18n catalog: a code without translations does not compile.
   */
  readonly code: ErrorCode;
  /** English, for developers and logs only — never shown to users. */
  readonly message: string;
  readonly params?: Record<string, unknown>;
  readonly details?: readonly FieldDetail[];
  /** When the caller may try again, in seconds (a lockout, OQ-114). */
  readonly retryAfterSeconds?: number;
}

/** A throwable refusal. */
export type DomainError = Error & { readonly domainError: DomainErrorInit };

/**
 * Creates a throwable refusal.
 *
 * @param init - The code, developer message and optional params/details.
 * @returns An `Error` carrying `init`.
 */
export const createDomainError = (init: DomainErrorInit): DomainError => (
  Object.assign(new Error(init.message), { domainError: init })
);

/**
 * Tells whether a thrown value was created by `createDomainError`.
 *
 * @param value - Anything caught.
 * @returns `true` when `value` carries a refusal.
 */
export const isDomainError = (value: unknown): value is DomainError => (
  value instanceof Error && 'domainError' in value
);

/**
 * Builds the `validation.failed` refusal — one shape whether the route's
 * contract check or a Manager's ValidationUtility check found the problems.
 *
 * @param details - One entry per failing field.
 * @returns The refusal, ready to throw.
 */
export const validationFailed = (details: readonly FieldDetail[]): DomainError => (
  createDomainError({ code: 'validation.failed', message: 'Request validation failed', details })
);

/**
 * What a log line records about a failure caught outside a request — a bus
 * subscriber's, say: the error as text, and a refusal's code and params, which
 * `String(error)` would drop.
 *
 * @param error - Anything caught.
 * @returns The details to log.
 */
export const failureDetails = (error: unknown): Record<string, unknown> => (
  isDomainError(error)
    ? {
      error: String(error),
      code: error.domainError.code,
      ...(error.domainError.params ? { params: error.domainError.params } : {}),
    }
    : { error: String(error) }
);
