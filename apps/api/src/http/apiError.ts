import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** One field-level problem, rendered by the frontend from `code` + `params`. */
export interface FieldDetail {
  readonly field: string;
  readonly code: string;
  readonly params?: Record<string, unknown>;
}

/** Everything the error envelope (`components/schemas/Error`) needs, minus the correlation id. */
export interface ApiErrorInit {
  readonly status: ContentfulStatusCode;
  /** Namespaced and stable (`domain.reason`), localized by the frontend (OQ-83). */
  readonly code: string;
  /** English, for developers and logs only — never shown to users. */
  readonly message: string;
  readonly params?: Record<string, unknown>;
  readonly details?: readonly FieldDetail[];
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
