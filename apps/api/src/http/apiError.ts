import type { ErrorCode } from '@financas/i18n';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { FieldDetail } from '../utilities/validation';

// A field's problem is ValidationUtility's own shape (U3); the envelope carries it.
export type { FieldDetail };

/** Everything the error envelope (`components/schemas/Error`) needs, minus the correlation id. */
export interface ApiErrorInit {
  readonly status: ContentfulStatusCode;
  /**
   * Namespaced and stable (`domain.reason`), localized by the frontend (OQ-83).
   * Typed by the i18n catalog: a code without translations does not compile.
   */
  readonly code: ErrorCode;
  /** English, for developers and logs only — never shown to users. */
  readonly message: string;
  readonly params?: Record<string, unknown>;
  readonly details?: readonly FieldDetail[];
  /** Extra response headers, e.g. `Retry-After` on a 429. */
  readonly headers?: Readonly<Record<string, string>>;
}

/** A throwable error that the error handler renders as the API error envelope. */
export type ApiError = Error & { readonly apiError: ApiErrorInit };

/**
 * Creates a throwable error that becomes a contract-shaped error response.
 *
 * @param init - Status, code, developer message and optional params/details.
 * @returns An `Error` carrying `init` for the error handler.
 */
export const createApiError = (init: ApiErrorInit): ApiError => (
  Object.assign(new Error(init.message), { apiError: init })
);

/**
 * Tells whether a thrown value was created by `createApiError`.
 *
 * @param value - Anything caught by the error handler.
 * @returns `true` when `value` carries an envelope description.
 */
export const isApiError = (value: unknown): value is ApiError => (
  value instanceof Error && 'apiError' in value
);

/**
 * Builds the 422 `validation.failed` error — one shape whether the route's
 * contract check or a Manager's ValidationUtility check found the problems.
 *
 * @param details - One entry per failing field.
 * @returns The error, ready to throw.
 */
export const validationFailed = (details: readonly FieldDetail[]): ApiError => createApiError({
  status: 422,
  code: 'validation.failed',
  message: 'Request validation failed',
  details,
});
