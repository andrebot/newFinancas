import type { MessageParams } from './i18n';

// What an Experience answers a Flow's request with (EBD): Flows never call the
// backend, they hand each request up as a callback and get back an outcome.
// A failure carries the API (or client) error code and its ICU params, which
// the Flow shows through I18nUtility — never the response's `message`.

/** Why a request failed: an API (or client) error code and its ICU params. */
export interface RequestFailure {
  readonly code: string;
  readonly params?: MessageParams | undefined;
}

/** What the Experience answers for a request a Flow makes. */
export type RequestOutcome = { readonly ok: true } | {
  readonly ok: false;
  readonly error: RequestFailure;
};
