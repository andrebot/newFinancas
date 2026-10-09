import { randomUUID } from 'node:crypto';

// CorrelationIdUtility (U1, VBD): the ID that ties together everything one
// request causes — log lines across Manager → Engine → Accessor, service-bus
// messages and the error envelope (NFR-OBS-1). It is passed explicitly as a
// parameter, never read from ambient state (OQ-99).

/** A validated correlation ID; only this module creates one. */
export type CorrelationId = string & { readonly brand: 'CorrelationId' };

// Any RFC 9562 UUID (versions 1–8), so a client may send v4 or v7.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Tells whether a value received from outside is an acceptable correlation ID.
 * Only UUIDs pass, so nothing unexpected (newlines, markup, huge strings) can
 * reach the logs through it.
 *
 * @param value - e.g. the `X-Correlation-Id` request header.
 * @returns `true` for a well-formed UUID.
 */
export const isValidCorrelationId = (value: string | undefined): value is string => (
  value !== undefined && UUID.test(value)
);

/**
 * Creates a new correlation ID.
 *
 * @param generate - UUID source; injectable so tests are deterministic.
 * @returns A fresh ID.
 */
export const newCorrelationId = (generate: () => string = randomUUID): CorrelationId => (
  generate().toLowerCase() as CorrelationId
);

/**
 * Keeps a well-formed incoming ID (so a client action and its server logs share
 * one ID) or mints a new one.
 *
 * @param incoming - The ID the caller sent, if any.
 * @param generate - UUID source for a new ID.
 * @returns The ID to use for this request, lower-cased.
 */
export const resolveCorrelationId = (
  incoming: string | undefined,
  generate: () => string = randomUUID,
): CorrelationId => (
  isValidCorrelationId(incoming)
    ? incoming.toLowerCase() as CorrelationId
    : newCorrelationId(generate)
);
